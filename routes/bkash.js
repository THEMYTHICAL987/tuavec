const express = require('express');
const router = express.Router();
const { Order } = require('../models');
const bkash = require('../utils/bkash');

// bKash callback/webhook endpoint
router.post('/callback', async (req, res) => {
    try {
        const payload = req.body;
        console.log('📣 bKash callback received:', payload);

        // The exact payload shape depends on bKash configuration. Try to find paymentID or merchantInvoiceNumber
        const paymentId = payload && (payload.paymentID || payload.paymentId || payload.trxID || payload.transactionId);
        const merchantInvoice = payload && (payload.merchantInvoiceNumber || payload.merchantInvoice || payload.invoice);

        // Try to locate the order
        let order = null;
        if (merchantInvoice) {
            order = await Order.findOne({ orderNumber: merchantInvoice });
        }
        if (!order && paymentId) {
            order = await Order.findOne({ 'paymentDetails.bkash.paymentId': paymentId });
        }

        if (!order) {
            console.warn('bKash callback: order not found for payload', payload);
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Verify with bKash to ensure transaction is valid
        try {
            const verification = await bkash.verifyPayment(paymentId || (order.paymentDetails && order.paymentDetails.bkash && order.paymentDetails.bkash.paymentId));
            // Basic check - real implementations should inspect verification object carefully
            if (verification && (verification.paymentID || verification.transactionStatus || verification.transactionStatusCode === '0000' || verification.status === 'completed')) {
                order.paymentStatus = 'paid';
                order.orderStatus = 'confirmed';
                order.paymentDetails = order.paymentDetails || {};
                order.paymentDetails.bkash = {
                    ...order.paymentDetails.bkash,
                    verifiedAt: new Date(),
                    verification
                };
                await order.save();

                return res.json({ success: true, message: 'Order payment verified and updated' });
            }
        } catch (verErr) {
            console.error('bKash verification error:', verErr);
            return res.status(400).json({ success: false, error: 'Payment verification failed', details: verErr.message });
        }

        res.status(400).json({ success: false, error: 'Unverified payment' });
    } catch (err) {
        console.error('bKash callback handler error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
