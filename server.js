const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tuavec')
    .then(() => {
        console.log('✅ MongoDB Connected');
        console.log(`📊 Database: ${mongoose.connection.name}`);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// ========== ROUTES ==========

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        success: true,
        message: 'Tu Avec API is running',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);

// Image upload route
const { uploadSingle, uploadMultiple, handleUploadError } = require('./middleware/upload');
const { authenticate, adminOnly } = require('./middleware/auth');

app.post('/api/upload/single', authenticate, adminOnly, uploadSingle, handleUploadError, (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({
        success: true,
        message: 'File uploaded successfully',
        url: fileUrl,
        filename: req.file.filename
    });
});

app.post('/api/upload/multiple', authenticate, adminOnly, uploadMultiple, handleUploadError, (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No files uploaded'
        });
    }
    
    const files = req.files.map(file => ({
        url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
        filename: file.filename
    }));
    
    res.json({
        success: true,
        message: `${files.length} files uploaded successfully`,
        files
    });
});

// Admin stats endpoint
app.get('/api/admin/stats', authenticate, adminOnly, async (req, res) => {
    try {
        const { Product, Order, User, Review } = require('./models');
        
        const totalProducts = await Product.countDocuments({ status: 'active' });
        const totalOrders = await Order.countDocuments();
        const totalCustomers = await User.countDocuments({ role: 'customer' });
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const pendingReviews = await Review.countDocuments({ status: 'pending' });
        
        const revenueResult = await Order.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;
        
        const ordersByStatus = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('orderNumber customer total status createdAt');
        
        const lowStockProducts = await Product.find({ stock: { $lt: 10 }, status: 'active' })
            .select('title stock')
            .limit(10);
        
        res.json({
            success: true,
            stats: {
                totalProducts,
                totalOrders,
                totalCustomers,
                totalRevenue,
                pendingOrders,
                pendingReviews,
                ordersByStatus,
                recentOrders,
                lowStockProducts
            }
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// Seed database (development only)
if (process.env.NODE_ENV !== 'production') {
    app.post('/api/seed', async (req, res) => {
        try {
            const { Product, Category } = require('./models');
            
            const sampleProducts = [
                {
                    title: 'Ferrero Rocher 24pc Premium Gift Box',
                    description: 'Luxurious hazelnut chocolates wrapped in golden foil. Perfect for gifting.',
                    category: 'Chocolates',
                    brand: 'Ferrero',
                    price: 1850,
                    comparePrice: 2100,
                    stock: 50,
                    featured: true,
                    images: [{ url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=500', isPrimary: true }],
                    tags: ['chocolate', 'premium', 'gift', 'ferrero']
                },
                {
                    title: 'Nike Air Max Women\'s Running Shoes',
                    description: 'Premium running shoes with air cushioning technology',
                    category: 'Footwear',
                    subcategory: 'Running Shoes',
                    brand: 'Nike',
                    price: 8500,
                    comparePrice: 10000,
                    stock: 25,
                    featured: true,
                    images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500', isPrimary: true }],
                    variants: [
                        { name: 'Size', value: '7', stock: 5 },
                        { name: 'Size', value: '8', stock: 10 },
                        { name: 'Size', value: '9', stock: 10 }
                    ],
                    tags: ['shoes', 'nike', 'running', 'athletic']
                },
                {
                    title: 'MAC Ruby Woo Lipstick',
                    description: 'Iconic matte red lipstick with long-lasting formula',
                    category: 'Cosmetics',
                    subcategory: 'Lipstick',
                    brand: 'MAC',
                    price: 2500,
                    stock: 50,
                    featured: true,
                    images: [{ url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500', isPrimary: true }],
                    tags: ['lipstick', 'mac', 'makeup', 'cosmetics']
                }
            ];
            
            const products = await Product.insertMany(sampleProducts);
            
            res.json({
                success: true,
                message: 'Database seeded successfully',
                productsCreated: products.length
            });
            
        } catch (error) {
            console.error('Seed error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to seed database'
            });
        }
    });
}

// ========== ERROR HANDLING ==========

// Import error handlers
const { errorHandler, notFound } = require('./middleware/auth');

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ========== START SERVER ==========

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log('');
    console.log('🚀 =====================================');
    console.log('🚀 Tu Avec Backend Server Started');
    console.log('🚀 =====================================');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`📚 API Prefix: /api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🚀 =====================================');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

module.exports = app;
