const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  vendorCommissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
});

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    items: [orderItemSchema],
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true }
    },
    shippingAddress: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      region: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      area: { type: String, trim: true },
      address: { type: String, required: true, trim: true }
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'bkash', 'nagad', 'rocket'],
      required: true
    },
    notes: { type: String, trim: true, default: '' },
    giftWrap: { type: Boolean, default: false },
    couponCode: { type: String, trim: true, uppercase: true, default: null },
    benefitDiscount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 100, min: 0 },
    subscriberOrder: { type: Boolean, default: false },
    rewardsApplied: { type: Boolean, default: false },
    inventoryReserved: { type: Boolean, default: false },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
