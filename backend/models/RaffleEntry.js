const mongoose = require('mongoose');

const raffleEntrySchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true, trim: true },
    orderTotal: { type: Number, required: true, min: 3000 },
    drawYear: { type: Number, required: true },
    status: { type: String, enum: ['eligible', 'winner', 'void'], default: 'eligible' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RaffleEntry', raffleEntrySchema);