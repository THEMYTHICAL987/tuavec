const express = require('express');
const router = express.Router();
const { Order } = require('../models');
const { notifyLogisticsAlertSMS, buildLogisticsStatusMessage } = require('../services/smsService');

const normalizedStatusMap = {
    pending: 'pending',
    confirmed: 'confirmed',
    dispatched: 'dispatched',
    shipped: 'dispatched',
    'in_transit': 'in-transit',
    'in-transit': 'in-transit',
    'in transit': 'in-transit',
    transit: 'in-transit',
    'failed_delivery_attempt': 'delayed',
    'failed-delivery-attempt': 'delayed',
    hold: 'delayed',
    delayed: 'delayed',
    delivered: 'delivered',
    returned: 'returned',
    'returned_to_sender': 'returned',
    'returned-to-sender': 'returned'
};

const delayStates = new Set(['delayed', 'hold', 'failed_delivery_attempt', 'failed-delivery-attempt', 'attempted_delivery', 'attempted-delivery', 'delivery_failed_attempt']);

router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-logistics-webhook-signature'] || req.headers['x-webhook-signature'] || req.headers['x-webhook-secret'];
        if (process.env.LOGISTICS_WEBHOOK_SECRET) {
            if (!signature || signature !== process.env.LOGISTICS_WEBHOOK_SECRET) {
                return res.status(401).json({ success: false, error: 'Unauthorized webhook request' });
            }
        }

        const payload = req.body || {};
        const orderIdentifier = String(payload.orderNumber || payload.order_id || payload.reference || payload.trackingId || payload.tracking_id || payload.trackingNumber || payload.tracking_number || '').trim();
        const rawStatus = String(payload.status || payload.currentStatus || payload.event || payload.state || '').trim().toLowerCase();

        if (!orderIdentifier) {
            return res.status(400).json({ success: false, error: 'Missing order identifier in webhook payload' });
        }

        const normalizedStatus = normalizedStatusMap[rawStatus] || 'pending';
        const courierName = String(payload.courierName || payload.courier || payload.carrier || payload.provider || '').trim() || undefined;
        const trackingId = String(payload.trackingId || payload.tracking_id || payload.trackingNumber || payload.tracking_number || '').trim() || undefined;
        const notes = String(payload.notes || payload.remark || payload.description || payload.message || '').trim() || undefined;

        const order = await Order.findOne({ orderNumber: orderIdentifier })
            || await Order.findOne({ _id: orderIdentifier })
            || await Order.findOne({ 'logistics.trackingId': orderIdentifier })
            || await Order.findOne({ 'courier.trackingNumber': orderIdentifier });

        if (!order) {
            console.warn('Logistics webhook could not find order for identifier:', orderIdentifier);
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        if (!order.logistics) {
            order.logistics = {
                courierName: courierName || order.logistics?.courierName,
                trackingId: trackingId || order.logistics?.trackingId,
                currentStatus: 'pending',
                statusLogs: [],
                unboxingVideoUrl: order.logistics?.unboxingVideoUrl
            };
        }

        order.logistics.courierName = courierName || order.logistics.courierName;
        order.logistics.trackingId = trackingId || order.logistics.trackingId;

        const currentStatus = delayStates.has(rawStatus) ? 'delayed' : normalizedStatus;
        order.logistics.currentStatus = currentStatus;

        order.logistics.statusLogs.push({
            status: currentStatus,
            updatedBy: 'logistics-webhook',
            timestamp: new Date(),
            notes
        });

        if (!Array.isArray(order.timeline)) {
            order.timeline = [];
        }

        order.timeline.push({
            status: currentStatus,
            message: `Logistics update received${notes ? `: ${notes}` : ''}`,
            timestamp: new Date(),
            updatedBy: 'logistics-webhook'
        });

        await order.save();

        // Placeholder SMS notification call to alert the customer proactively.
        try {
            if (order.customer?.phone) {
                const logisticsAlert = buildLogisticsStatusMessage(order.orderNumber, currentStatus, order.logistics.courierName, notes);
                await notifyLogisticsAlertSMS(order.customer.phone, logisticsAlert);
            }
        } catch (smsError) {
            console.error('Logistics webhook SMS notification failed:', smsError);
        }

        res.json({
            success: true,
            message: 'Logistics event processed',
            logistics: order.logistics
        });
    } catch (error) {
        console.error('Logistics webhook error:', error);
        res.status(500).json({ success: false, error: 'Failed to process logistics webhook' });
    }
});

module.exports = router;
