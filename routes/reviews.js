const express = require('express');
const router = express.Router();
const { Review, Product, Order } = require('../models');
const { authenticate, adminOnly } = require('../middleware/auth');
const { getPaginationData } = require('../utils/helpers');

// ========== CREATE REVIEW ==========
router.post('/', authenticate, async (req, res) => {
    try {
        const { productId, orderId, rating, title, comment, images } = req.body;
        
        if (!productId || !rating || !comment) {
            return res.status(400).json({
                success: false,
                error: 'Product, rating, and comment are required'
            });
        }
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 5'
            });
        }
        
        // Check if user already reviewed this product
        const existingReview = await Review.findOne({
            product: productId,
            user: req.userId
        });
        
        if (existingReview) {
            return res.status(400).json({
                success: false,
                error: 'You have already reviewed this product'
            });
        }
        
        // Check if this is a verified purchase
        let isVerifiedPurchase = false;
        if (orderId) {
            const order = await Order.findOne({
                _id: orderId,
                user: req.userId,
                'items.product': productId,
                status: 'delivered'
            });
            isVerifiedPurchase = !!order;
        }
        
        // Create review
        const review = await Review.create({
            product: productId,
            user: req.userId,
            order: orderId,
            rating,
            title,
            comment,
            images,
            isVerifiedPurchase,
            status: 'pending' // Needs approval
        });
        
        // Update product rating
        await updateProductRating(productId);
        
        res.status(201).json({
            success: true,
            message: 'Review submitted successfully. It will be published after moderation.',
            review
        });
        
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit review'
        });
    }
});

// ========== GET PRODUCT REVIEWS ==========
router.get('/product/:productId', async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
        
        const query = {
            product: req.params.productId,
            status: 'approved'
        };
        
        const total = await Review.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);
        
        const reviews = await Review.find(query)
            .populate('user', 'name')
            .sort({ [sortBy]: -1 })
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage);
        
        // Get rating distribution
        const distribution = await Review.aggregate([
            { $match: { product: req.params.productId, status: 'approved' } },
            { $group: { _id: '$rating', count: { $sum: 1 } } }
        ]);
        
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        distribution.forEach(d => {
            ratingCounts[d._id] = d.count;
        });
        
        res.json({
            success: true,
            reviews,
            pagination,
            stats: {
                total,
                distribution: ratingCounts
            }
        });
        
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reviews'
        });
    }
});

// ========== MODERATE REVIEW (ADMIN) ==========
router.patch('/:reviewId/moderate', authenticate, adminOnly, async (req, res) => {
    try {
        const { status, adminResponse } = req.body; // status: approved, rejected
        
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }
        
        const review = await Review.findByIdAndUpdate(
            req.params.reviewId,
            { 
                status,
                ...(adminResponse && {
                    adminResponse,
                    adminResponseDate: new Date()
                })
            },
            { new: true }
        );
        
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        
        // Update product rating
        if (status === 'approved') {
            await updateProductRating(review.product);
        }
        
        res.json({
            success: true,
            message: `Review ${status} successfully`,
            review
        });
        
    } catch (error) {
        console.error('Moderate review error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to moderate review'
        });
    }
});

// ========== MARK REVIEW HELPFUL ==========
router.post('/:reviewId/helpful', async (req, res) => {
    try {
        const { helpful } = req.body; // true or false
        
        const review = await Review.findById(req.params.reviewId);
        
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        
        if (helpful) {
            review.helpful += 1;
        } else {
            review.notHelpful += 1;
        }
        
        await review.save();
        
        res.json({
            success: true,
            helpful: review.helpful,
            notHelpful: review.notHelpful
        });
        
    } catch (error) {
        console.error('Mark helpful error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update'
        });
    }
});

// ========== GET PENDING REVIEWS (ADMIN) ==========
router.get('/admin/pending', authenticate, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const query = { status: 'pending' };
        const total = await Review.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);
        
        const reviews = await Review.find(query)
            .populate('product', 'title images')
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage);
        
        res.json({
            success: true,
            reviews,
            pagination
        });
        
    } catch (error) {
        console.error('Get pending reviews error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reviews'
        });
    }
});

// ========== HELPER FUNCTION ==========
async function updateProductRating(productId) {
    try {
        const result = await Review.aggregate([
            { $match: { product: productId, status: 'approved' } },
            { $group: { 
                _id: null, 
                averageRating: { $avg: '$rating' },
                count: { $sum: 1 }
            }}
        ]);
        
        if (result.length > 0) {
            await Product.findByIdAndUpdate(productId, {
                rating: Math.round(result[0].averageRating * 10) / 10,
                reviewCount: result[0].count
            });
        }
    } catch (error) {
        console.error('Update product rating error:', error);
    }
}

module.exports = router;
