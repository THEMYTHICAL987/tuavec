const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OTP } = require('../models');

// ========== JWT UTILITIES ==========

const generateToken = (userId, expiresIn = '7d') => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
};

// ========== PASSWORD UTILITIES ==========

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

// ========== OTP UTILITIES ==========

const generateOTP = () => {
    // Generate 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const saveOTP = async (phone, purpose) => {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    // Delete old OTPs for this phone
    await OTP.deleteMany({ phone, purpose });
    
    // Create new OTP
    await OTP.create({
        phone,
        otp,
        purpose,
        expiresAt
    });
    
    return otp;
};

const verifyOTP = async (phone, otp, purpose) => {
    const otpDoc = await OTP.findOne({
        phone,
        otp,
        purpose,
        verified: false,
        expiresAt: { $gt: new Date() }
    });
    
    if (!otpDoc) {
        return { success: false, error: 'Invalid or expired OTP' };
    }
    
    // Increment attempts
    otpDoc.attempts += 1;
    
    if (otpDoc.attempts > 3) {
        await otpDoc.deleteOne();
        return { success: false, error: 'Too many attempts. Please request a new OTP.' };
    }
    
    // Mark as verified
    otpDoc.verified = true;
    await otpDoc.save();
    
    return { success: true };
};

// ========== SMS UTILITIES ==========

const sendSMS = async (phone, message) => {
    // TODO: Integrate with SMS API (e.g., Twilio, Msg91, BulkSMS BD)
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`📱 SMS to ${phone}: ${message}`);
        return { success: true };
    }
    
    try {
        // Example: Using a Bangladesh SMS API
        // const response = await fetch('https://sms-api.com/send', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         api_key: process.env.SMS_API_KEY,
        //         to: phone,
        //         message: message
        //     })
        // });
        // return await response.json();
        
        console.log(`📱 SMS to ${phone}: ${message}`);
        return { success: true };
    } catch (error) {
        console.error('SMS Error:', error);
        return { success: false, error: error.message };
    }
};

const sendOTPSMS = async (phone, otp) => {
    const message = `Your Tu Avec verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
    return await sendSMS(phone, message);
};

const sendOrderConfirmationSMS = async (phone, orderNumber) => {
    const message = `Thank you for your order! Your order #${orderNumber} has been confirmed. Track your order at tuavec.com/track`;
    return await sendSMS(phone, message);
};

const sendDeliveryUpdateSMS = async (phone, orderNumber, status) => {
    let message = '';
    
    switch (status) {
        case 'confirmed':
            message = `Your order #${orderNumber} has been confirmed and is being prepared.`;
            break;
        case 'processing':
            message = `Your order #${orderNumber} is being processed.`;
            break;
        case 'shipped':
            message = `Great news! Your order #${orderNumber} has been shipped and is on its way.`;
            break;
        case 'delivered':
            message = `Your order #${orderNumber} has been delivered. Thank you for shopping with Tu Avec!`;
            break;
    }
    
    return await sendSMS(phone, message);
};

// ========== WHATSAPP UTILITIES ==========

const sendWhatsApp = async (phone, message) => {
    // TODO: Integrate with WhatsApp Business API
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`💬 WhatsApp to ${phone}: ${message}`);
        return { success: true };
    }
    
    try {
        // Example integration would go here
        console.log(`💬 WhatsApp to ${phone}: ${message}`);
        return { success: true };
    } catch (error) {
        console.error('WhatsApp Error:', error);
        return { success: false, error: error.message };
    }
};

// ========== EMAIL UTILITIES ==========

const sendEmail = async (to, subject, html) => {
    // TODO: Integrate with email service (e.g., SendGrid, Mailgun, AWS SES)
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`📧 Email to ${to}: ${subject}`);
        return { success: true };
    }
    
    try {
        // Example integration would go here
        console.log(`📧 Email to ${to}: ${subject}`);
        return { success: true };
    } catch (error) {
        console.error('Email Error:', error);
        return { success: false, error: error.message };
    }
};

const sendOrderConfirmationEmail = async (email, orderNumber, orderDetails) => {
    const subject = `Order Confirmation - ${orderNumber}`;
    const html = `
        <h1>Thank you for your order!</h1>
        <p>Your order <strong>${orderNumber}</strong> has been confirmed.</p>
        <p>We'll send you an update when it ships.</p>
        <a href="${process.env.FRONTEND_URL}/track/${orderNumber}">Track your order</a>
    `;
    
    return await sendEmail(email, subject, html);
};

// ========== VALIDATION UTILITIES ==========

const isValidPhone = (phone) => {
    // Bangladesh phone number validation
    const phoneRegex = /^(\+88)?01[3-9]\d{8}$/;
    return phoneRegex.test(phone);
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const sanitizePhone = (phone) => {
    // Remove +88 prefix if present, ensure 11 digits
    phone = phone.replace(/\D/g, ''); // Remove non-digits
    if (phone.startsWith('88')) {
        phone = phone.substring(2);
    }
    return phone;
};

// ========== SHIPPING UTILITIES ==========

const calculateShipping = (region, itemCount = 1) => {
    const shippingRates = {
        'Dhaka': 60,
        'Chittagong': 100,
        'Sylhet': 120,
        'Rajshahi': 120,
        'Khulna': 120,
        'Barisal': 130,
        'Rangpur': 130,
        'Mymensingh': 100
    };
    
    const baseShipping = shippingRates[region] || 100;
    
    // Additional charge for multiple items
    const additionalFee = Math.max(0, itemCount - 3) * 20;
    
    return baseShipping + additionalFee;
};

const estimateDelivery = (region) => {
    const deliveryDays = {
        'Dhaka': 1,
        'Chittagong': 2,
        'Sylhet': 3,
        'Rajshahi': 3,
        'Khulna': 3,
        'Barisal': 3,
        'Rangpur': 3,
        'Mymensingh': 2
    };
    
    const days = deliveryDays[region] || 3;
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + days);
    
    return estimatedDate;
};

// ========== ORDER UTILITIES ==========

const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `TUA-${timestamp.substr(-8)}-${random}`;
};

// ========== SLUG UTILITIES ==========

const generateSlug = (text) => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

// ========== IMAGE UTILITIES ==========

const getImageUrl = (filename) => {
    if (!filename) return null;
    
    // If already a full URL, return as is
    if (filename.startsWith('http')) {
        return filename;
    }
    
    // Construct URL based on environment
    const baseUrl = process.env.API_URL || 'http://localhost:5000';
    return `${baseUrl}/uploads/${filename}`;
};

// ========== PAGINATION UTILITIES ==========

const getPaginationData = (page = 1, limit = 20, total) => {
    const currentPage = parseInt(page);
    const itemsPerPage = parseInt(limit);
    const totalPages = Math.ceil(total / itemsPerPage);
    const skip = (currentPage - 1) * itemsPerPage;
    
    return {
        currentPage,
        itemsPerPage,
        totalPages,
        totalItems: total,
        skip,
        hasMore: currentPage < totalPages,
        hasPrevious: currentPage > 1
    };
};

// ========== DISCOUNT UTILITIES ==========

const calculateDiscount = (price, comparePrice) => {
    if (!comparePrice || comparePrice <= price) return 0;
    
    return Math.round(((comparePrice - price) / comparePrice) * 100);
};

// ========== EXPORTS ==========

module.exports = {
    // JWT
    generateToken,
    verifyToken,
    
    // Password
    hashPassword,
    comparePassword,
    
    // OTP
    generateOTP,
    saveOTP,
    verifyOTP,
    
    // SMS
    sendSMS,
    sendOTPSMS,
    sendOrderConfirmationSMS,
    sendDeliveryUpdateSMS,
    
    // WhatsApp
    sendWhatsApp,
    
    // Email
    sendEmail,
    sendOrderConfirmationEmail,
    
    // Validation
    isValidPhone,
    isValidEmail,
    sanitizePhone,
    
    // Shipping
    calculateShipping,
    estimateDelivery,
    
    // Order
    generateOrderNumber,
    
    // Utilities
    generateSlug,
    getImageUrl,
    getPaginationData,
    calculateDiscount
};
