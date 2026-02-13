const mongoose = require('mongoose');

// ========== USER MODEL ==========
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    addresses: [{
        label: String, // Home, Office, etc.
        fullName: String,
        phone: String,
        region: String,
        city: String,
        area: String,
        address: String,
        isDefault: { type: Boolean, default: false }
    }],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

// ========== PRODUCT MODEL ==========
const productSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    subcategory: String,
    brand: String,
    
    // Pricing
    price: { type: Number, required: true },
    comparePrice: Number, // Original price (for discounts)
    cost: Number, // Your cost (for profit calculation)
    
    // Inventory
    stock: { type: Number, default: 0 },
    sku: String,
    trackInventory: { type: Boolean, default: true },
    
    // Images
    images: [{
        url: { type: String, required: true },
        alt: String,
        isPrimary: { type: Boolean, default: false }
    }],
    
    // Variants (for shoes: sizes, cosmetics: shades, etc.)
    variants: [{
        name: String, // Size, Color, Flavor, etc.
        value: String, // 7, Red, Chocolate, etc.
        price: Number, // Price adjustment
        stock: Number,
        sku: String,
        image: String
    }],
    
    // Features & Specs
    features: [String],
    specifications: mongoose.Schema.Types.Mixed, // Flexible object
    
    // SEO & Tags
    tags: [String],
    metaTitle: String,
    metaDescription: String,
    
    // Status
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
    featured: { type: Boolean, default: false },
    
    // Stats
    viewCount: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate slug from title
productSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = this.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    this.updatedAt = Date.now();
    next();
});

// ========== REVIEW MODEL ==========
const reviewSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // Verified purchase
    
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: String,
    comment: { type: String, required: true },
    
    // Images uploaded by reviewer
    images: [String],
    
    // Moderation
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isVerifiedPurchase: { type: Boolean, default: false },
    
    // Admin response
    adminResponse: String,
    adminResponseDate: Date,
    
    // Helpfulness
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    
    createdAt: { type: Date, default: Date.now }
});

// ========== ORDER MODEL ==========
const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    
    // Customer Info
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },
    
    // Delivery Address
    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        region: { type: String, required: true },
        city: { type: String, required: true },
        area: String,
        address: { type: String, required: true },
        landmark: String,
        notes: String // Delivery instructions
    },
    
    // Items
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: { type: String, required: true },
        slug: String,
        image: String,
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        variant: {
            name: String,
            value: String
        },
        subtotal: Number
    }],
    
    // Pricing
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountCode: String,
    total: { type: Number, required: true },
    
    // Payment
    paymentMethod: { 
        type: String, 
        required: true,
        enum: ['cod', 'bkash', 'nagad', 'rocket', 'card']
    },
    paymentStatus: { 
        type: String, 
        enum: ['unpaid', 'pending', 'paid', 'refunded'],
        default: 'unpaid'
    },
    
    // Payment details for manual verification
    paymentDetails: {
        transactionId: String,
        senderNumber: String,
        amount: Number,
        screenshot: String,
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verifiedAt: Date
    },
    
    // Order Status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'pending'
    },
    
    // Status Timeline
    timeline: [{
        status: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Delivery
    courier: {
        name: String, // Pathao, Steadfast, etc.
        trackingNumber: String,
        trackingUrl: String
    },
    estimatedDelivery: Date,
    deliveredAt: Date,
    
    // Admin Notes
    internalNotes: String,
    
    // Return/Refund
    returnRequest: {
        requested: { type: Boolean, default: false },
        reason: String,
        status: { type: String, enum: ['pending', 'approved', 'rejected'] },
        refundAmount: Number,
        processedAt: Date
    },
    
    // Metadata
    source: { type: String, default: 'website' }, // website, facebook, phone
    ipAddress: String,
    userAgent: String,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate order number
orderSchema.pre('save', function(next) {
    if (!this.orderNumber) {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        this.orderNumber = `TUA-${timestamp.substr(-8)}-${random}`;
    }
    this.updatedAt = Date.now();
    next();
});

// ========== OTP MODEL ==========
const otpSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    otp: { type: String, required: true },
    purpose: { type: String, enum: ['signup', 'login', 'reset'], required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ========== CATEGORY MODEL ==========
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },
    description: String,
    image: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    productCount: { type: Number, default: 0 }
});

// ========== COUPON MODEL ==========
const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    description: String,
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    minPurchase: Number,
    maxDiscount: Number,
    usageLimit: Number,
    usageCount: { type: Number, default: 0 },
    validFrom: Date,
    validUntil: Date,
    isActive: { type: Boolean, default: true },
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    applicableCategories: [String],
    createdAt: { type: Date, default: Date.now }
});

// ========== NOTIFICATION MODEL ==========
const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: ['order', 'payment', 'delivery', 'review', 'promotion'],
        required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// ========== EXPORTS ==========
module.exports = {
    User: mongoose.model('User', userSchema),
    Product: mongoose.model('Product', productSchema),
    Review: mongoose.model('Review', reviewSchema),
    Order: mongoose.model('Order', orderSchema),
    OTP: mongoose.model('OTP', otpSchema),
    Category: mongoose.model('Category', categorySchema),
    Coupon: mongoose.model('Coupon', couponSchema),
    Notification: mongoose.model('Notification', notificationSchema)
};
