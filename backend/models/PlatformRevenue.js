const mongoose = require('mongoose');

const platformRevenueSchema = new mongoose.Schema(
  {
    totalCommissionsEarned: {
      type: Number,
      default: 0,
      min: 0
    },
    totalOwnerProductSales: {
      type: Number,
      default: 0,
      min: 0
    },
    totalVendorSales: {
      type: Number,
      default: 0,
      min: 0
    },
    transactionHistory: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order'
        },
        type: {
          type: String,
          enum: ['commission', 'owner_sale'],
          required: true
        },
        amount: {
          type: Number,
          required: true
        },
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          default: null
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformRevenue', platformRevenueSchema);
