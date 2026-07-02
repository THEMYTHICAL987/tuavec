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
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

// ========== POST MODEL (for Blog) ==========
const postSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    content: { type: String, required: true },
    excerpt: { type: String, maxlength: 300 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true, index: true },
    tags: [String],
    featuredImage: {
        url: String,
        alt: String
    },
    published: { type: Boolean, default: false },
    publishedAt: Date,
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now }
    }],
    seoTitle: String,
    seoDescription: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate slug from title
postSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = this.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
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
    postCount: { type: Number, default: 0 }
});

// ========== NOTIFICATION MODEL ==========
const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: ['post', 'comment', 'promotion'],
        required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// ========== PRODUCT MODEL ==========
const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    shortDescription: { type: String, maxlength: 200 },
    category: { type: String, required: true, index: true },
    subcategory: String,
    brand: { type: String, index: true },
    sku: { type: String, index: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, min: 0 },
    cost: { type: Number, min: 0 }, // For profit calculations
    stock: { type: Number, default: 0 },
    images: [{
        url: { type: String, required: true },
        alt: String,
        isPrimary: { type: Boolean, default: false }
    }],
    inventory: {
        quantity: { type: Number, default: 0, min: 0 },
        sku: String,
        trackInventory: { type: Boolean, default: true }
    },
    variants: [{
        sku: String,
        name: String, // e.g., "Size", "Color"
        value: String, // e.g., "M", "Red"
        price: { type: Number, min: 0 },
        stock: { type: Number, default: 0 },
        image: String,
        active: { type: Boolean, default: true }
    }],
    specifications: [{
        key: String,
        value: String
    }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    warrantyInfo: String,
    returnPolicy: String,
    tags: [String],
    weight: Number, // in grams
    dimensions: {
        length: Number,
        width: Number,
        height: Number
    },
    seoTitle: String,
    seoDescription: String,
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    salesCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Support both legacy `stock` field and structured inventory data.
productSchema.pre('save', function(next) {
    // Generate slug from name if needed
    if (this.isModified('name') || !this.slug) {
        this.slug = this.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Sync inventory quantity and stock for backward compatibility.
    if (this.inventory && typeof this.inventory.quantity === 'number') {
        this.stock = this.inventory.quantity;
    } else if (typeof this.stock === 'number') {
        this.inventory = this.inventory || {};
        this.inventory.quantity = this.stock;
    }

    this.updatedAt = Date.now();
    next();
});

// Create a text index for better search relevance.
productSchema.index({
    name: 'text',
    description: 'text',
    tags: 'text',
    brand: 'text',
    category: 'text'
});

// ========== REVIEW MODEL ==========
const reviewSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 100 },
    comment: { type: String, required: true, maxlength: 1000 },
    images: [String],
    verified: { type: Boolean, default: false }, // Purchased and verified
    helpful: { type: Number, default: 0 },
    reported: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ========== ORDER MODEL ==========
const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: {
        name: { type: String, required: true },
        email: String,
        phone: { type: String, required: true }
    },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        variant: String,
        image: String
    }],
    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        region: { type: String, required: true },
        city: { type: String, required: true },
        area: String,
        address: { type: String, required: true }
    },
    paymentMethod: { type: String, required: true },
    paymentDetails: {
        bKash: mongoose.Schema.Types.Mixed,
        transactionId: String,
        senderNumber: String,
        amount: Number,
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verifiedAt: Date
    },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    orderStatus: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'], default: 'pending' },
    timeline: [{
        status: { type: String, required: true },
        message: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    courier: {
        name: String,
        trackingNumber: String,
        provider: String
    },
    logistics: {
        courierName: String,
        trackingId: String,
        currentStatus: {
            type: String,
            enum: ['pending', 'confirmed', 'dispatched', 'in-transit', 'delayed', 'delivered', 'returned'],
            default: 'pending'
        },
        statusLogs: [{
            status: {
                type: String,
                enum: ['pending', 'confirmed', 'dispatched', 'in-transit', 'delayed', 'delivered', 'returned'],
                required: true
            },
            updatedBy: { type: String, default: 'system' },
            timestamp: { type: Date, default: Date.now },
            notes: String
        }],
        unboxingVideoUrl: String
    },
    returnRequest: {
        requested: { type: Boolean, default: false },
        reason: String,
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: Date
    },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    couponCode: String,
    notes: String,
    giftWrap: { type: Boolean, default: false },
    trackingNumber: String,
    estimatedDelivery: Date,
    deliveredAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ========== EXPORTS ==========
module.exports = {
    User: mongoose.model('User', userSchema),
    Post: mongoose.model('Post', postSchema),
    Product: mongoose.model('Product', productSchema),
    Review: mongoose.model('Review', reviewSchema),
    Order: mongoose.model('Order', orderSchema),
    OTP: mongoose.model('OTP', otpSchema),
    Category: mongoose.model('Category', categorySchema),
    Notification: mongoose.model('Notification', notificationSchema)
};
