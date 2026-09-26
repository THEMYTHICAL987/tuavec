const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    amount: { type: Number, required: true, enum: [10000, 20000, 30000, 40000, 50000] },
    balance: { type: Number, required: true, min: 0 },
    purchaserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientEmail: { type: String, trim: true, lowercase: true, default: '' },
    status: { type: String, enum: ['active', 'depleted', 'cancelled'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GiftCard', giftCardSchema);