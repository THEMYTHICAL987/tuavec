const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    loyaltyMonths: { type: Number, default: 0, min: 0 },
    loyaltyDiscountCap: { type: Number, default: 10, min: 0, max: 50 },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    raffleTokens: { type: Number, default: 0, min: 0 },
    isSubscriber: { type: Boolean, default: false },
    subscriptionStartedAt: { type: Date, default: null },
    subscriptionRenewsAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
