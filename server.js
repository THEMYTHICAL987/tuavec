const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ========== ENHANCED CORS MIDDLEWARE ==========
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.8.107:3000',
    'http://192.168.8.103:3000',
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,
    /\.vercel\.app$/,
    /\.netlify\.app$/,
    /\.onrender\.com$/
];

app.use(cors({
    origin: function (origin, callback) {
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

// Serve uploads from root or backend folder (fallbacks)
const uploadsPaths = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'tuavec-complete-final', 'backend', 'uploads')
];
uploadsPaths.forEach(p => {
    if (fs.existsSync(p)) {
        app.use('/uploads', express.static(p));
    }
});

// Serve frontend static files if present (Netlify-style `frontend` folder)
const frontendPath = path.join(__dirname, 'tuavec-complete-final', 'frontend');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
}

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tuavec')
    .then(() => {
        console.log('✅ MongoDB Connected to Tu Avec');
        console.log('📦 Database:', mongoose.connection.name);
    })
    .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    // server keeps running, DB routes will just fail
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

// ========== SPA / 404 HANDLER ==========
app.use('*', (req, res) => {
    // If the client expects HTML, serve the frontend index (SPA fallback)
    if (req.method === 'GET' && req.accepts && req.accepts('html')) {
        const indexFile = path.join(frontendPath, 'index.html');
        if (fs.existsSync(indexFile)) {
            return res.sendFile(indexFile);
        }
    }

    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Tu Avec Backend running on port ${PORT}`);
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