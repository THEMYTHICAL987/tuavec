const jwt = require('jsonwebtoken');
const { User } = require('../models');

// ========== AUTHENTICATION MIDDLEWARE ==========

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required. Please login.' 
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'User not found. Please login again.' 
            });
        }
        
        // Attach user to request
        req.user = user;
        req.userId = user._id;
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token. Please login again.' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                error: 'Token expired. Please login again.' 
            });
        }
        res.status(500).json({ 
            success: false,
            error: 'Authentication failed.' 
        });
    }
};

// Optional authentication (for features that work with or without login)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            
            if (user) {
                req.user = user;
                req.userId = user._id;
            }
        }
        
        next();
    } catch (error) {
        // Ignore auth errors, continue as guest
        next();
    }
};

// Admin only access
const adminOnly = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required.' 
            });
        }
        
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Admin access required.' 
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Authorization failed.' 
        });
    }
};

// ========== RATE LIMITING ==========

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map();

const rateLimit = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // Max requests per window
        message = 'Too many requests, please try again later.'
    } = options;
    
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        // Clean up old entries
        for (const [k, v] of rateLimitStore.entries()) {
            if (now - v.resetTime > windowMs) {
                rateLimitStore.delete(k);
            }
        }
        
        // Get or create rate limit entry
        let rateData = rateLimitStore.get(key);
        
        if (!rateData) {
            rateData = {
                count: 0,
                resetTime: now
            };
            rateLimitStore.set(key, rateData);
        }
        
        // Reset if window expired
        if (now - rateData.resetTime > windowMs) {
            rateData.count = 0;
            rateData.resetTime = now;
        }
        
        // Increment count
        rateData.count++;
        
        // Check limit
        if (rateData.count > max) {
            return res.status(429).json({
                success: false,
                error: message,
                retryAfter: Math.ceil((rateData.resetTime + windowMs - now) / 1000)
            });
        }
        
        // Add rate limit info to headers
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rateData.count));
        res.setHeader('X-RateLimit-Reset', new Date(rateData.resetTime + windowMs).toISOString());
        
        next();
    };
};

// Specific rate limiters
const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts
    message: 'Too many login attempts. Please try again after 15 minutes.'
});

const otpRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // 3 OTP requests
    message: 'Too many OTP requests. Please try again after 5 minutes.'
});

const orderRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 orders per hour
    message: 'Too many orders. Please try again later.'
});

// ========== VALIDATION MIDDLEWARE ==========

const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors
            });
        }
        
        next();
    };
};

// ========== ERROR HANDLER ==========

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.keys(err.errors).map(key => ({
            field: key,
            message: err.errors[key].message
        }));
        
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            errors
        });
    }
    
    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            error: `${field} already exists`
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token expired'
        });
    }
    
    // Default error
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// ========== NOT FOUND HANDLER ==========

const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`
    });
};

module.exports = {
    authenticate,
    optionalAuth,
    adminOnly,
    rateLimit,
    loginRateLimit,
    otpRateLimit,
    orderRateLimit,
    validateRequest,
    errorHandler,
    notFound
};
