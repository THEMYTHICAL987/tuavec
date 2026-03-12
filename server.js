const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ========== ENHANCED CORS MIDDLEWARE ==========
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.8.107:3000',
    'http://192.168.8.103:3000',
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,  // Any local network IP
    /\.vercel\.app$/,
    /\.netlify\.app$/,
    /\.onrender\.com$/
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        
        const isAllowed = allowedOrigins.some(allowed => 
            allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
        );
        
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error(`CORS block: Origin ${origin} not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tuavec', {
    // No deprecated options needed in newer versions
})
    .then(() => {
        console.log('✅ MongoDB Connected to Tu Avec');
        console.log('📦 Database:', mongoose.connection.name);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// ========== HEALTH CHECK ROUTE ==========
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Tu Avec API is running',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

// ========== ROUTES ==========
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ========== 404 HANDLER ==========
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Tu Avec Backend running on:`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://192.168.8.107:${PORT}`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`   - GET  /health`);
    console.log(`   - GET  /api/products`);
    console.log(`   - GET  /api/products/:id`);
    console.log(`   - POST /api/orders`);
    console.log(`\n✅ Server ready to accept connections!\n`);
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, closing server gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n👋 SIGINT received, closing server gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});