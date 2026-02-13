const express = require('express');
const router = express.Router();
const { Order, Product } = require('../models');
const { authenticate, optionalAuth, adminOnly, orderRateLimit } = require('../middleware/auth');
const { 
    calculateShipping, 
    estimateDelivery,
    sendOrderConfirmationSMS,
    sendOrderConfirmationEmail,
    sendDeliveryUpdateSMS,
    getPaginationData
} = require('../utils/helpers');

// ========== CREATE ORDER ==========
router.post('/', orderRateLimit, optionalAuth, async (req, res) => {
    try {
        const { customer, shippingAddress, items, paymentMethod, discountCode } = req.body;
        
        // Validation
        if (!customer || !shippingAddress || !items || !items.length || !paymentMethod) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Calculate totals
        let subtotal = 0;
        const orderItems = [];
        
        for (const item of items) {
            const product = await Product.findById(item.productId);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: `Product not found: ${item.productId}`
                });
            }
            
            if (product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient stock for ${product.title}`
                });
            }
            
            const itemSubtotal = product.price * item.quantity;
            subtotal += itemSubtotal;
            
            orderItems.push({
                product: product._id,
                title: product.title,
                slug: product.slug,
                image: product.images[0]?.url,
                price: product.price,
                quantity: item.quantity,
                variant: item.variant,
                subtotal: itemSubtotal
            });
        }
        
        // Calculate shipping
        const shippingCost = calculateShipping(
            shippingAddress.region, 
            items.reduce((sum, item) => sum + item.quantity, 0)
        );
        
        // Apply discount if any
        let discount = 0;
        // TODO: Implement coupon logic
        
        const total = subtotal + shippingCost - discount;
        
        // Create order
        const order = await Order.create({
            user: req.userId || null,
            customer,
            shippingAddress,
            items: orderItems,
            subtotal,
            shippingCost,
            discount,
            discountCode,
            total,
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'pending',
            estimatedDelivery: estimateDelivery(shippingAddress.region),
            timeline: [{
                status: 'pending',
                message: 'Order placed successfully',
                timestamp: new Date()
            }],
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        // Update product stock
        for (const item of items) {
            await Product.findByIdAndUpdate(
                item.productId,
                { 
                    $inc: { stock: -item.quantity, salesCount: item.quantity }
                }
            );
        }
        
        // Send notifications
        await sendOrderConfirmationSMS(customer.phone, order.orderNumber);
        await sendOrderConfirmationEmail(customer.email, order.orderNumber, order);
        
        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            orderNumber: order.orderNumber,
            order
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order'
        });
    }
});

// ========== GET USER ORDERS ==========
router.get('/my-orders', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        let query = { user: req.userId };
        if (status) query.status = status;
        
        const total = await Order.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);
        
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage)
            .select('-__v');
        
        res.json({
            success: true,
            orders,
            pagination
        });
        
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders'
        });
    }
});

// ========== GET SINGLE ORDER ==========
router.get('/:orderNumber', optionalAuth, async (req, res) => {
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber })
            .populate('items.product', 'title slug images');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        // Check authorization
        if (order.user && req.userId && order.user.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access'
            });
        }
        
        res.json({
            success: true,
            order
        });
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order'
        });
    }
});

// ========== TRACK ORDER (PUBLIC) ==========
router.get('/track/:orderNumber', async (req, res) => {
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber })
            .select('orderNumber status timeline estimatedDelivery customer.name shippingAddress.region courier');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            tracking: {
                orderNumber: order.orderNumber,
                status: order.status,
                timeline: order.timeline,
                estimatedDelivery: order.estimatedDelivery,
                customerName: order.customer.name,
                region: order.shippingAddress.region,
                courier: order.courier
            }
        });
        
    } catch (error) {
        console.error('Track order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track order'
        });
    }
});

// ========== UPDATE ORDER STATUS (ADMIN) ==========
router.patch('/:orderNumber/status', authenticate, adminOnly, async (req, res) => {
    try {
        const { status, message, courierName, trackingNumber } = req.body;
        
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }
        
        const order = await Order.findOne({ orderNumber: req.params.orderNumber });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        // Update status
        order.status = status;
        
        // Add to timeline
        order.timeline.push({
            status,
            message: message || `Order ${status}`,
            timestamp: new Date(),
            updatedBy: req.userId
        });
        
        // Update courier info if provided
        if (courierName || trackingNumber) {
            order.courier = {
                ...order.courier,
                ...(courierName && { name: courierName }),
                ...(trackingNumber && { trackingNumber })
            };
        }
        
        // Set delivered date
        if (status === 'delivered') {
            order.deliveredAt = new Date();
        }
        
        await order.save();
        
        // Send SMS notification
        await sendDeliveryUpdateSMS(order.customer.phone, order.orderNumber, status);
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            order
        });
        
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update order status'
        });
    }
});

// ========== VERIFY PAYMENT (ADMIN) ==========
router.patch('/:orderNumber/verify-payment', authenticate, adminOnly, async (req, res) => {
    try {
        const { transactionId, senderNumber, amount } = req.body;
        
        const order = await Order.findOne({ orderNumber: req.params.orderNumber });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        order.paymentDetails = {
            transactionId,
            senderNumber,
            amount,
            verifiedBy: req.userId,
            verifiedAt: new Date()
        };
        
        order.paymentStatus = 'paid';
        
        await order.save();
        
        res.json({
            success: true,
            message: 'Payment verified successfully',
            order
        });
        
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment'
        });
    }
});

// ========== REQUEST RETURN (CUSTOMER) ==========
router.post('/:orderNumber/return', authenticate, async (req, res) => {
    try {
        const { reason } = req.body;
        
        const order = await Order.findOne({ 
            orderNumber: req.params.orderNumber,
            user: req.userId
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        if (order.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                error: 'Only delivered orders can be returned'
            });
        }
        
        order.returnRequest = {
            requested: true,
            reason,
            status: 'pending'
        };
        
        await order.save();
        
        res.json({
            success: true,
            message: 'Return request submitted successfully'
        });
        
    } catch (error) {
        console.error('Request return error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit return request'
        });
    }
});

// ========== GET ALL ORDERS (ADMIN) ==========
router.get('/admin/all', authenticate, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, paymentStatus, search } = req.query;
        
        let query = {};
        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;
        
        if (search) {
            query.$or = [
                { orderNumber: new RegExp(search, 'i') },
                { 'customer.name': new RegExp(search, 'i') },
                { 'customer.phone': new RegExp(search, 'i') }
            ];
        }
        
        const total = await Order.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);
        
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.itemsPerPage)
            .populate('user', 'name email')
            .select('-__v');
        
        res.json({
            success: true,
            orders,
            pagination
        });
        
    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders'
        });
    }
});

module.exports = router;
