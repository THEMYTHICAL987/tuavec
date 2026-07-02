const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { Product, Review } = require('../models');
const { authenticate, optionalAuth, adminOnly } = require('../middleware/auth');
const { getPaginationData, calculateDiscount } = require('../utils/helpers');

const resolveProductQuery = (identifier) => {
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        return { _id: identifier };
    }
    return { slug: identifier };
};

// ========== GET ALL PRODUCTS (PUBLIC) ==========
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            category,
            subcategory,
            brand,
            search,
            minPrice,
            maxPrice,
            minRating,
            inStock,
            onSale,
            tags,
            sort,
            page = 1,
            limit = 20,
            featured
        } = req.query;

        const query = { status: 'active' };

        if (category) query.category = category;
        if (subcategory) query.subcategory = subcategory;
        if (brand) query.brand = brand;
        if (featured === 'true') query.featured = true;
        if (tags) query.tags = { $in: tags.split(',').map(tag => tag.trim()) };

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        if (minRating) {
            query.rating = { $gte: parseFloat(minRating) };
        }

        if (inStock === 'true') {
            query.$or = [
                { stock: { $gt: 0 } },
                { 'inventory.quantity': { $gt: 0 } }
            ];
        }

        if (onSale === 'true') {
            query.comparePrice = { $gt: 0 };
            query.$expr = { $gt: ['$comparePrice', '$price'] };
        }

        if (search) {
            query.$text = { $search: search };
        }

        const total = await Product.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);

        let sortOption = { createdAt: -1 };
        switch (sort) {
            case 'price_low':
                sortOption = { price: 1 };
                break;
            case 'price_high':
                sortOption = { price: -1 };
                break;
            case 'rating':
                sortOption = { rating: -1 };
                break;
            case 'popular':
                sortOption = { salesCount: -1, rating: -1 };
                break;
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        const products = await Product.find(query)
            .sort(sortOption)
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage)
            .select('-__v');

        const productsWithDiscount = products.map(product => {
            const prod = product.toObject();
            if (prod.comparePrice) {
                prod.discountPercent = calculateDiscount(prod.price, prod.comparePrice);
            }
            return prod;
        });

        res.json({
            success: true,
            products: productsWithDiscount,
            pagination: {
                totalCount: pagination.totalItems,
                totalPages: pagination.totalPages,
                currentPage: pagination.currentPage,
                perPage: pagination.itemsPerPage,
                hasMore: pagination.hasMore
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products'
        });
    }
});

// ========== GET CATEGORY META (PUBLIC) ==========
router.get('/meta/categories', async (req, res) => {
    try {
        const categories = await Product.distinct('category', { status: 'active' });

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

// ========== GET BRAND META (PUBLIC) ==========
router.get('/meta/brands', async (req, res) => {
    try {
        const brands = await Product.distinct('brand', { status: 'active' });

        res.json({
            success: true,
            brands
        });
    } catch (error) {
        console.error('Get brands error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch brands'
        });
    }
});

// ========== SEARCH PRODUCTS (PUBLIC) ==========
router.get('/search', async (req, res) => {
    try {
        const { q = '', limit = 10 } = req.query;

        if (!q.trim()) {
            return res.json({ success: true, products: [] });
        }

        const products = await Product.find({
            $text: { $search: q },
            status: 'active'
        })
            .limit(parseInt(limit))
            .select('name slug price images brand rating');

        res.json({ success: true, products });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { limit = 10 } = req.query;

        const products = await Product.find({
            $text: { $search: query },
            status: 'active'
        })
            .limit(parseInt(limit))
            .select('name slug price images brand rating');

        res.json({ success: true, products });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// ========== GET RELATED PRODUCTS (PUBLIC) ==========
router.get('/:id/related', async (req, res) => {
    try {
        const product = await Product.findOne(resolveProductQuery(req.params.id));
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const related = await Product.find({
            status: 'active',
            _id: { $ne: product._id },
            $or: [
                { category: product.category },
                { tags: { $in: product.tags || [] } }
            ]
        })
            .sort({ rating: -1, salesCount: -1 })
            .limit(8)
            .select('name slug price comparePrice images brand rating');

        res.json({ success: true, products: related });
    } catch (error) {
        console.error('Get related products error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch related products' });
    }
});

// ========== PRODUCT REVIEWS (PUBLIC/PERSONAL) ==========
router.get('/:id/reviews', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const product = await Product.findOne(resolveProductQuery(req.params.id));

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const reviewQuery = { product: product._id, status: 'approved' };
        const total = await Review.countDocuments(reviewQuery);
        const pagination = getPaginationData(page, limit, total);

        const reviews = await Review.find(reviewQuery)
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage);

        res.json({
            success: true,
            reviews,
            pagination: {
                totalCount: pagination.totalItems,
                totalPages: pagination.totalPages,
                currentPage: pagination.currentPage,
                perPage: pagination.itemsPerPage,
                hasMore: pagination.hasMore
            }
        });
    } catch (error) {
        console.error('Get product reviews error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
    }
});

router.post('/:id/reviews', authenticate, async (req, res) => {
    try {
        const product = await Product.findOne(resolveProductQuery(req.params.id));

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const { rating, title, comment, images = [], verified = false } = req.body;

        if (!rating || !comment) {
            return res.status(400).json({ success: false, error: 'Rating and comment are required' });
        }

        const review = await Review.create({
            product: product._id,
            user: req.user._id,
            rating,
            title,
            comment,
            images,
            verified: Boolean(verified),
            status: 'approved'
        });

        const aggregated = await Review.aggregate([
            { $match: { product: product._id, status: 'approved' } },
            {
                $group: {
                    _id: '$product',
                    averageRating: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        if (aggregated.length) {
            product.rating = Number(aggregated[0].averageRating.toFixed(1));
            product.reviewCount = aggregated[0].count;
            await product.save();
        }

        res.status(201).json({ success: true, review });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ success: false, error: 'Failed to post review' });
    }
});

// ========== GET SINGLE PRODUCT (PUBLIC) ==========
router.get('/:identifier', optionalAuth, async (req, res) => {
    try {
        const product = await Product.findOne(resolveProductQuery(req.params.identifier));

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        product.views = (product.views || 0) + 1;
        await product.save();

        const reviews = await Review.find({ product: product._id, status: 'approved' })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(10);

        const related = await Product.find({
            status: 'active',
            _id: { $ne: product._id },
            $or: [
                { category: product.category },
                { tags: { $in: product.tags || [] } }
            ]
        })
            .limit(6)
            .select('name slug price comparePrice images rating');

        const productData = product.toObject();
        if (productData.comparePrice) {
            productData.discountPercent = calculateDiscount(productData.price, productData.comparePrice);
        }

        res.json({
            success: true,
            product: productData,
            reviews,
            relatedProducts: related
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
});

// ========== CREATE PRODUCT (ADMIN) ==========
router.post('/', authenticate, adminOnly, async (req, res) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({ success: true, message: 'Product created successfully', product });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ success: false, error: 'Failed to create product' });
    }
});

// ========== UPDATE PRODUCT (ADMIN) ==========
router.put('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        res.json({ success: true, message: 'Product updated successfully', product });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ success: false, error: 'Failed to update product' });
    }
});

// ========== DELETE PRODUCT (ADMIN) ==========
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
});

module.exports = router;
