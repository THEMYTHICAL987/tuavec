const express = require('express');
const router = express.Router();
const { Order, Product } = require('../models');
const bkash = require('../utils/bkash');
const { authenticate, optionalAuth, adminOnly, orderRateLimit } = require('../middleware/auth');
const { 
    calculateShipping, 
    estimateDelivery,
    sendOrderConfirmationSMS,
    sendOrderConfirmationEmail,
    sendDeliveryUpdateSMS,
    getPaginationData,
    generateOrderNumber
} = require('../utils/helpers');

// ========== CREATE ORDER ==========
router.post('/', orderRateLimit, optionalAuth, async (req, res) => {
    try {
        console.log('📦 Received order request:', req.body);
        
        const { customer, shippingAddress, items, paymentMethod } = req.body;
        
        // Validate required fields
        if (!customer || !shippingAddress || !items || !paymentMethod) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Order must have at least one item'
            });
        }
        
        // Validate all items have productId
        for (const item of items) {
            if (!item.productId) {
                return res.status(400).json({
                    success: false,
                    error: 'All items must have a productId'
                });
            }
        }
        
        // ✅ GENERATE ORDER NUMBER
        const orderNumber = generateOrderNumber();
        console.log('✅ Generated order number:', orderNumber);
        
        // Calculate totals
        let subtotal = 0;
        const enrichedItems = [];
        
        for (const item of items) {
            const product = await Product.findById(item.productId);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: `Product not found: ${item.productId}`
                });
            }
            
            const availableStock = typeof product.stock === 'number' ? product.stock : (product.inventory?.quantity || 0);
            if (availableStock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient stock for ${product.name || product.title}`
                });
            }
            
            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;
            
            enrichedItems.push({
                product: product._id,
                name: product.name || product.title || 'Unnamed product',
                price: product.price,
                quantity: item.quantity,
                variant: item.variant || undefined,
                image: product.images?.[0]?.url || undefined
            });
            console.log('🔧 Enriched item:', {
                product: product._id,
                name: product.name || product.title,
                price: product.price,
                quantity: item.quantity
            });
        }
        
        console.log('🔧 Order route source file:', __filename);
        console.log('🔧 Enriched items array:', JSON.stringify(enrichedItems, null, 2));
        
        // Calculate shipping and delivery estimate
        const shippingCost = calculateShipping(shippingAddress.region, enrichedItems.length);
        const estimatedDelivery = estimateDelivery(shippingAddress.region);
        const totalAmount = subtotal + shippingCost;
        
        console.log('💰 Order totals:', { subtotal, shippingCost, totalAmount, estimatedDelivery });
        
        // ✅ CREATE ORDER WITH ORDER NUMBER
        const order = new Order({
            orderNumber,
            user: req.userId || undefined,
            customer,
            shippingAddress,
            items: enrichedItems,
            paymentMethod,
            subtotal,
            shippingCost,
            totalAmount,
            estimatedDelivery,
            paymentStatus: 'pending',
            orderStatus: 'pending',
            timeline: [{
                status: 'pending',
                message: 'Order created',
                timestamp: new Date(),
                updatedBy: req.userId || undefined
            }]
        });
        
        console.log('💾 Saving order:', order);
        
        await order.save();
        
        console.log('✅ Order saved successfully!');

        // Send order confirmation notifications.
        if (customer.phone) {
            await sendOrderConfirmationSMS(customer.phone, orderNumber);
        }
        if (customer.email) {
            await sendOrderConfirmationEmail(customer.email, orderNumber, {
                totalAmount,
                shippingCost,
                estimatedDelivery
            });
        }

        // Update product stock
        for (const item of items) {
            await Product.findByIdAndUpdate(
                item.productId,
                { 
                    $inc: { 
                        stock: -item.quantity,
                        'inventory.quantity': -item.quantity,
                        salesCount: item.quantity
                    }
                }
            );
        }
        
        console.log('✅ Stock updated');
        
        // If payment method is bKash, create a payment link and return it
        if (paymentMethod === 'bkash') {
            try {
                const callbackUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/bkash/callback`;
                const payment = await bkash.createPayment({ amount: totalAmount, orderId: order._id, orderNumber, callbackUrl });

                // Save payment metadata on the order for later verification
                order.paymentDetails = order.paymentDetails || {};
                order.paymentDetails.bkash = {
                    paymentId: payment.paymentId || null,
                    raw: payment.raw || null,
                    createdAt: new Date()
                };
                await order.save();

                return res.status(201).json({
                    success: true,
                    message: 'Order created. Redirect to payment.',
                    orderNumber: orderNumber,
                    order: {
                        _id: order._id,
                        orderNumber: order.orderNumber,
                        totalAmount: order.totalAmount,
                        status: order.orderStatus || order.status
                    },
                    paymentUrl: payment.paymentUrl || (payment.raw && payment.raw.bkashURL) || null
                });
            } catch (payErr) {
                console.error('bKash payment creation failed:', payErr);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create bKash payment link',
                    details: payErr.message
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            orderNumber: orderNumber,
            order: {
                _id: order._id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                status: order.orderStatus || order.status
            }
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create order'
        });
    }
});

// ========== GET USER ORDERS ==========
router.get('/my-orders', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        let query = { user: req.userId };
        if (status) query.orderStatus = status;
        
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

// ========== TRACK ORDER (PUBLIC) ==========
router.get('/track/:orderNumber', async (req, res) => {
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber })
            .select('orderNumber orderStatus status timeline estimatedDelivery customer.name shippingAddress.region courier');
        
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
                status: order.orderStatus || order.status,
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
        order.orderStatus = status;
        
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
        
        if (order.orderStatus !== 'delivered') {
            return res.status(400).json({
                success: false,
                error: 'Only delivered orders can be returned'
            });
        }
        
        order.returnRequest = {
            requested: true,
            reason,
            status: 'pending',
            requestedAt: new Date()
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
        if (status) query.orderStatus = status;
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

module.exports = router;