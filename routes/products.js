const express = require('express');
const router = express.Router();
const { Product, Review } = require('../models');
const { authenticate, optionalAuth, adminOnly } = require('../middleware/auth');
const { getPaginationData, calculateDiscount } = require('../utils/helpers');

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
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1, 
            limit = 20,
            featured
        } = req.query;
        
        // Build query
        let query = { status: 'active' };
        
        if (category) query.category = category;
        if (subcategory) query.subcategory = subcategory;
        if (brand) query.brand = brand;
        if (featured === 'true') query.featured = true;
        
        // Price range
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        
        // Search
        if (search) {
            query.$text = { $search: search };
        }
        
        // Count total
        const total = await Product.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);
        
        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        
        // Execute query
        const products = await Product.find(query)
            .sort(sort)
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage)
            .select('-__v');
        
        // Add discount percentage
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
            pagination
        });
        
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products'
        });
    }
});

// ========== GET SINGLE PRODUCT (PUBLIC) ==========
router.get('/:slug', optionalAuth, async (req, res) => {
    try {
        const product = await Product.findOne({ slug: req.params.slug });
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        // Increment view count
        product.viewCount += 1;
        await product.save();
        
        // Get reviews
        const reviews = await Review.find({ 
            product: product._id, 
            status: 'approved' 
        })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get related products
        const related = await Product.find({
            category: product.category,
            _id: { $ne: product._id },
            status: 'active'
        })
            .limit(6)
            .select('title slug price comparePrice images rating');
        
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
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product'
        });
    }
});

// ========== CREATE PRODUCT (ADMIN) ==========
router.post('/', authenticate, adminOnly, async (req, res) => {
    try {
        const product = await Product.create(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product
        });
        
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create product'
        });
    }
});

// ========== UPDATE PRODUCT (ADMIN) ==========
router.put('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product updated successfully',
            product
        });
        
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update product'
        });
    }
});

// ========== DELETE PRODUCT (ADMIN) ==========
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete product'
        });
    }
});

// ========== GET CATEGORIES (PUBLIC) ==========
router.get('/meta/categories', async (req, res) => {
    try {
        const categories = await Product.distinct('category', { status: 'active' });
        const brands = await Product.distinct('brand', { status: 'active' });
        
        res.json({
            success: true,
            categories,
            brands
        });
        
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

// ========== SEARCH PRODUCTS (PUBLIC) ==========
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { limit = 10 } = req.query;
        
        const products = await Product.find({
            $text: { $search: query },
            status: 'active'
        })
            .limit(parseInt(limit))
            .select('title slug price images');
        
        res.json({
            success: true,
            products
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    }
});

module.exports = router;
