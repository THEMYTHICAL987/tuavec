const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

// Import models
const Vendor = require('./models/Vendor');
const Product = require('./models/Product');
const Order = require('./models/Order');
const User = require('./models/User');
const PlatformRevenue = require('./models/PlatformRevenue');
const WarrantyClaim = require('./models/WarrantyClaim');
const GiftCard = require('./models/GiftCard');
const RaffleEntry = require('./models/RaffleEntry');
const digitalProducts = require('./data/digital-products');

// Import routes
const vendorRoutes = require('./routes/vendors');
const { adminAuth, authenticateUser, optionalAuthenticateUser } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
let databaseReady = false;
mongoose.set('bufferCommands', false);
mongoose.connection.on('connected', () => { databaseReady = true; });
mongoose.connection.on('disconnected', () => { databaseReady = false; });

// Middleware
const normalizeOrigin = origin => {
  try {
    return new URL(origin.includes('://') ? origin : `https://${origin}`).origin;
  } catch (_error) {
    return null;
  }
};
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => normalizeOrigin(origin.trim()))
  .filter(Boolean);
const allowedOrigins = new Set([
  'https://tuavec.netlify.app',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  ...configuredOrigins
]);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '2mb' }));
app.use('/api/support/assistant', rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Yow mini is busy. Please wait a minute and try again.' }
}));

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    databaseReady = true;
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Initialize platform revenue if it doesn't exist
    const platformRevenue = await PlatformRevenue.findOne();
    if (!platformRevenue) {
      await PlatformRevenue.create({
        totalCommissionsEarned: 0,
        totalOwnerProductSales: 0,
        totalVendorSales: 0,
        transactionHistory: []
      });
      console.log('Platform revenue initialized');
    }

    for (const product of digitalProducts) {
      await Product.updateOne(
        { slug: product.slug },
        { $setOnInsert: product },
        { upsert: true }
      );
    }
    console.log(`Digital catalog ready: ${digitalProducts.length} products`);
  } catch (error) {
    databaseReady = false;
    console.error('Error connecting to MongoDB:', error);
    console.error('Continuing without database access; database-backed requests will return an error until MONGODB_URI is fixed.');
  }
};

// Initialize database on startup
connectDB();

// Routes
app.use('/api/vendors', vendorRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  const [salt, expectedHash] = String(storedHash || '').split(':');
  if (!salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
};

const userResponse = user => ({ id: user._id, name: user.name, email: user.email, phone: user.phone });
const issueToken = user => jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '30d' });
const giftCardAmounts = [10000, 20000, 30000, 40000, 50000];

const getAssistantProductMatches = async message => {
  const normalized = String(message || '').toLowerCase();
  if (!databaseReady) return [];

  const knownTerms = ['skincare', 'skin', 'beauty', 'snack', 'food', 'tool', 'accessory', 'accessories', 'gift', 'thai', 'digital', 'template', 'office', 'travel', 'culture', 'wellness', 'health', 'cosmetic'];
  const terms = [...new Set(knownTerms.filter(term => normalized.includes(term)))].slice(0, 6);
  const budgetMatch = normalized.match(/(?:under|below|less than|up to|within|budget(?: of)?)\s*(?:\u09F3|tk|taka|bdt)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand)?/i);
  const budget = budgetMatch
    ? Number(budgetMatch[1].replace(/,/g, '')) * (/^(k|thousand)$/i.test(budgetMatch[2] || '') ? 1000 : 1)
    : null;
  const query = { stock: { $gt: 0 } };

  if (budget && Number.isFinite(budget)) query.price = { $lte: budget };
  if (terms.length) {
    query.$or = terms.map(term => ({
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { title: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } }
      ]
    }));
  }

  return Product.find(query)
    .select('name title category price originalPrice image images stock description')
    .sort({ featured: -1, createdAt: -1 })
    .limit(20);
};

const getAssistantFallbackResponse = async (message, history = []) => {
  const normalized = String(message || '').trim();
  const productContext = [...history.filter(entry => entry.role === 'user').map(entry => entry.content), normalized].join(' ');
  const needsHuman = /human|specialist|agent|complaint|refund|fraud|scam|wrong item|damaged|urgent|speak to someone/.test(normalized.toLowerCase());
  const asksPayment = /payment|pay|bkash|nagad|rocket|cash on delivery|cod|checkout|card/.test(normalized.toLowerCase());
  const asksOrder = /order|delivery|deliver|shipping|track|tracking|late|where is/.test(normalized.toLowerCase());
  const asksReturn = /return|exchange|warranty|broken|damaged|claim/.test(normalized.toLowerCase());
  const asksProduct = /buy|recommend|recommendation|looking for|find|suggest|skin|beauty|snack|food|tool|accessor|gift|digital|template|office|travel|culture|budget|under \d|below \d|up to \d|compare|which one/.test(normalized.toLowerCase())
    || /buy|recommend|looking for|suggest|skin|beauty|snack|food|accessor|gift|digital|template/.test(productContext.toLowerCase());

  let reply = 'I can help you choose products, understand delivery and payment, or connect you with a Yow by KSA specialist.';
  let intent = 'general';

  if (asksProduct) {
    intent = 'product';
    const products = await getAssistantProductMatches(productContext);
    reply = products.length
      ? `I found ${products.length} in-stock option${products.length === 1 ? '' : 's'} that may fit. Tell me your budget or preference and I can narrow it down.`
      : 'Tell me the category, intended use, and approximate budget. I can narrow down the best available options from our catalog.';
    return { intent, reply, products, handoff: false };
  }

  if (asksPayment) {
    intent = 'payment';
    reply = 'We support Cash on Delivery, bKash, Nagad, and Rocket. Use the payment method shown in checkout; never send money to a personal number. If checkout fails, share the exact error with a specialist.';
    return { intent, reply, products: [], handoff: needsHuman };
  }

  if (asksReturn) {
    intent = 'returns';
    reply = 'We offer 7-day returns for eligible items. Keep the packaging and send us your order number plus photos if the item is damaged, incorrect, or has a warranty issue.';
    return { intent, reply, products: [], handoff: true };
  }

  if (asksOrder) {
    intent = 'order';
    reply = 'For delivery help, sign in and open My Orders for your latest status. Dhaka usually takes 1–3 days and nationwide delivery 3–7 days. A specialist can investigate a delayed order with your order number.';
    return { intent, reply, products: [], handoff: true };
  }

  return { intent, reply, products: [], handoff: needsHuman };
};

const getAssistantAiReply = async (message, history = []) => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const productContext = [...history.filter(entry => entry.role === 'user').map(entry => entry.content), message].join(' ');
  const productIntent = /buy|recommend|recommendation|looking for|find|suggest|skin|beauty|snack|food|tool|accessor|gift|digital|template|office|travel|culture|budget|under \d|below \d|up to \d|compare|which one/i.test(productContext);
  const products = productIntent ? await getAssistantProductMatches(productContext) : [];
  const productCandidates = products.slice(0, 10).map(product => ({
    id: product._id.toString(),
    name: product.title || product.name,
    category: product.category,
    price: product.price,
    stock: product.stock,
    description: String(product.description || '').slice(0, 220)
  }));
  const systemPrompt = `You are Yow mini, customer support for Yow by KSA in Bangladesh. Return only a JSON object with keys "reply" (string) and "recommendedProductIds" (array of strings). Keep the reply concise, friendly, and plain English. Never invent products, prices, stock, policies, payment status, or order status. For product requests, you may choose only IDs from the provided in-stock catalog candidates; if none fit, say no matching in-stock item is available. Keep recommendations within the stated budget. Do not recommend products outside Yow by KSA. For payment issues, tell customers to use official checkout and never send money to a personal number. Do not claim a payment is received or an order confirmed unless the system explicitly says so. Refer refunds, complaints, urgent cases, and order-specific questions to a human specialist. Never delete, suppress, or disparage customer reviews.`;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(entry => ({ role: entry.role, content: entry.content })),
    {
      role: 'user',
      content: `Customer message: ${message}\nAvailable in-stock catalog candidates (choose IDs only from this list): ${JSON.stringify(productCandidates)}`
    }
  ];

  try {
    const provider = process.env.OPENAI_API_KEY ? 'openai' : 'openrouter';
    const client = provider === 'openai' ? new OpenAI({ apiKey, timeout: 15_000 }) : null;
    let content;

    if (!client) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5000',
          'X-Title': 'Yow mini'
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages
        })
      });
      if (!response.ok) throw new Error(`AI request failed with status ${response.status}`);
      const data = await response.json();
      content = data?.choices?.[0]?.message?.content?.trim();
    } else {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages
      });
      content = completion.choices?.[0]?.message?.content?.trim();
    }

    const parsed = JSON.parse(content || '{}');
    const validIds = new Set(productCandidates.map(product => product.id));
    const recommendedIds = Array.isArray(parsed.recommendedProductIds)
      ? [...new Set(parsed.recommendedProductIds.filter(id => validIds.has(String(id))).map(String))].slice(0, 4)
      : [];
    return {
      reply: typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 1200) : '',
      products: products.filter(product => recommendedIds.includes(product._id.toString()))
    };
  } catch (error) {
    console.error('AI assistant request failed:', error);
    return null;
  }
};

const applyOrderRewards = async order => {
  if (order.rewardsApplied || !databaseReady) return null;
  const points = Math.floor(order.total / 100) * 10;
  let raffleToken = null;
  if (order.userId) {
    await User.findByIdAndUpdate(order.userId, { $inc: { loyaltyPoints: points } });
  }
  if (order.total >= 3000) {
    raffleToken = `TA-${order._id.toString().slice(-8).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await RaffleEntry.create({
      token: raffleToken,
      orderId: order._id,
      userId: order.userId || null,
      customerName: order.customer.name,
      orderTotal: order.total,
      drawYear: new Date().getFullYear()
    });
    if (order.userId) await User.findByIdAndUpdate(order.userId, { $inc: { raffleTokens: 1 } });
  }
  order.rewardsApplied = true;
  await order.save();
  return { points, raffleToken };
};

app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (!name || !email || !phone || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and a 6-character password are required' });
    }
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) return res.status(409).json({ success: false, message: 'An account with that email or phone already exists' });

    const user = await User.create({ name, email, phone, passwordHash: hashPassword(password) });
    res.status(201).json({ success: true, token: issueToken(user), user: userResponse(user) });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Unable to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const emailOrPhone = String(req.body.emailOrPhone || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: req.body.emailOrPhone }] }).select('+passwordHash');
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
    }
    res.json({ success: true, token: issueToken(user), user: userResponse(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Unable to sign in' });
  }
});

app.get('/api/auth/me', authenticateUser, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user: userResponse(user) });
});

app.get('/api/benefits/me', authenticateUser, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, benefits: {
    loyaltyMonths: user.loyaltyMonths,
    loyaltyDiscountCap: user.loyaltyDiscountCap,
    loyaltyPoints: user.loyaltyPoints,
    raffleTokens: user.raffleTokens,
    isSubscriber: user.isSubscriber,
    subscriptionRenewsAt: user.subscriptionRenewsAt,
    freeDelivery: user.isSubscriber || user.loyaltyMonths >= 2
  }});
});

app.get('/api/raffle', async (_req, res) => {
  res.json({ success: true, year: new Date().getFullYear(), minimumOrder: 3000, prizes: [
    { place: 1, title: 'Grand prize appliance or vehicle', giftCard: 20000 },
    { place: 2, title: 'Game console or iPhone', giftCard: 10000 },
    { place: 3, title: 'Gift card, 2-month subscription, and exclusive offers', giftCard: 5000 }
  ] });
});

app.post('/api/loyalty/redeem', authenticateUser, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const points = Number(req.body.points);
  if (!Number.isInteger(points) || points < 100 || points % 100 !== 0) {
    return res.status(400).json({ success: false, message: 'Redeem points in whole 100-point blocks' });
  }
  const user = await User.findOneAndUpdate(
    { _id: req.user.id, loyaltyPoints: { $gte: points } },
    { $inc: { loyaltyPoints: -points } },
    { new: true }
  );
  if (!user) return res.status(400).json({ success: false, message: 'Insufficient loyalty points' });
  res.json({ success: true, pointsRemaining: user.loyaltyPoints, offerValue: points / 2, message: `Redeemed ${points} points for a ৳${points / 2} offer` });
});

app.post('/api/gift-cards', authenticateUser, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const amount = Number(req.body.amount);
  if (!giftCardAmounts.includes(amount)) return res.status(400).json({ success: false, message: 'Choose a valid gift card amount' });
  const code = `TA-${amount}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const giftCard = await GiftCard.create({ code, amount, balance: amount, purchaserId: req.user.id, recipientEmail: req.body.recipientEmail || '' });
  res.status(201).json({ success: true, giftCard: { code: giftCard.code, amount: giftCard.amount, balance: giftCard.balance } });
});

app.post('/api/gift-cards/redeem', authenticateUser, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const code = String(req.body.code || '').trim().toUpperCase();
  const amount = Math.max(1, Number(req.body.amount) || 0);
  const giftCard = await GiftCard.findOne({ code, status: 'active' });
  if (!giftCard || giftCard.balance < amount) return res.status(400).json({ success: false, message: 'Gift card is invalid or has insufficient balance' });
  giftCard.balance -= amount;
  if (giftCard.balance === 0) giftCard.status = 'depleted';
  await giftCard.save();
  await User.findByIdAndUpdate(req.user.id, { $inc: { loyaltyPoints: amount } });
  res.json({ success: true, balance: giftCard.balance });
});

app.post('/api/hiring/applications', async (req, res) => {
  const { name, email, phone, role } = req.body;
  if (!name || !email || !phone || !role) return res.status(400).json({ success: false, message: 'Name, email, phone, and role are required' });
  res.status(201).json({ success: true, message: 'Application received. Our team will contact you.' });
});

app.post('/api/support/assistant', async (req, res) => {
  const message = String(req.body?.message || '').trim().slice(0, 1200);
  if (!message) return res.status(400).json({ success: false, message: 'Tell us what you need help with.' });

  const history = Array.isArray(req.body.history)
    ? req.body.history.slice(-6).flatMap(entry => {
      const role = entry?.role;
      const content = String(entry?.content || '').trim().slice(0, 1000);
      return ['user', 'assistant'].includes(role) && content ? [{ role, content }] : [];
    })
    : [];

  let fallback;
  let aiReply;
  try {
    fallback = await getAssistantFallbackResponse(message, history);
    aiReply = await getAssistantAiReply(message, history);
  } catch (error) {
    console.error('Yow mini assistant request failed:', error);
    fallback = fallback || {
      intent: 'general',
      reply: 'I could not complete that request just now. Please try again or contact a Yow by KSA specialist.',
      products: [],
      handoff: true
    };
    aiReply = null;
  }
  const products = aiReply?.products?.length ? aiReply.products : (fallback.products || []).slice(0, 4);

  const finalReply = aiReply?.reply?.length > 0 ? aiReply.reply : fallback.reply;
  const finalHandoff = fallback.handoff || /human|specialist|agent|complaint|refund|fraud|scam|wrong item|damaged|urgent|speak to someone/.test(message.toLowerCase());

  res.json({
    success: true,
    intent: fallback.intent,
    reply: finalReply,
    products: products.map(product => ({
      id: product._id,
      name: product.title || product.name,
      category: product.category,
      price: product.price,
      image: product.image || product.images?.[0]?.url || null
    })),
    handoff: finalHandoff,
    specialistUrl: 'https://wa.me/8801310880044?text=Hello%20Yow%20by%20KSA%2C%20I%20need%20help%20with%20an%20order.',
    source: aiReply?.reply ? 'ai' : 'fallback'
  });
});

app.post('/api/subscriptions', authenticateUser, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const now = new Date();
  const renewsAt = new Date(now);
  renewsAt.setDate(renewsAt.getDate() + 30);
  user.isSubscriber = true;
  user.subscriptionStartedAt = user.subscriptionStartedAt || now;
  user.subscriptionRenewsAt = renewsAt;
  await user.save();
  res.status(201).json({ success: true, message: '30-day subscription activated', subscriptionRenewsAt: renewsAt });
});

app.get('/api/campaigns', async (_req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  try {
    const products = await Product.find({ campaignType: { $ne: 'none' }, stock: { $gt: 0 } })
      .select('name title price originalPrice stock campaignType campaignValue');
    res.json({ success: true, campaigns: products.map(product => ({
      productId: product._id,
      title: product.title || product.name,
      type: product.campaignType,
      value: product.campaignValue,
      stock: product.stock,
      message: product.campaignType === 'bogo'
        ? `Buy 1 get ${Math.max(1, Math.floor(product.campaignValue))} free`
        : `${product.campaignValue}% off while stock lasts`
    })) });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(503).json({ success: false, message: 'Campaigns are temporarily unavailable' });
  }
});

app.post('/api/warranty-claims', authenticateUser, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const { orderId, productId, reason } = req.body;
  if (!orderId || !productId || !String(reason || '').trim()) {
    return res.status(400).json({ success: false, message: 'Order, product, and a reason are required' });
  }
  const product = await Product.findById(productId);
  const order = await Order.findOne({ _id: orderId, userId: req.user.id });
  if (!product || !order) return res.status(404).json({ success: false, message: 'Order or product not found' });
  if (product.consumable || !product.warrantyEligible) {
    return res.status(400).json({ success: false, message: 'This product is not eligible for the one-year warranty' });
  }
  const claim = await WarrantyClaim.create({ userId: req.user.id, orderId, productId, reason: String(reason).trim() });
  res.status(201).json({ success: true, message: 'Warranty claim submitted for investigation', claim });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Yow by KSA marketplace is online',
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (_req, res) => {
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    api: 'online',
    database: databaseReady ? 'connected' : 'unavailable'
  });
});

// Helper: Get marketplace state
const getMarketplaceState = async () => {
  try {
    const vendorCount = await Vendor.countDocuments({ status: 'approved' });
    const merchantTarget = Number(process.env.MERCHANT_TARGET || 10);
    const vendorShare = Math.min(70, 40 + vendorCount * 3);
    const ownerShare = 100 - vendorShare;

    return {
      merchantTarget,
      currentMerchants: vendorCount,
      ownerShare,
      vendorShare,
      stage: vendorCount >= merchantTarget ? 'Marketplace-led growth' : 'Owner-led launch',
      message: vendorCount >= merchantTarget
        ? 'Your marketplace is now strong enough to shift more of the inventory to merchant partners.'
        : 'You still lead the store while more merchants join.'
    };
  } catch (error) {
    console.error('Error calculating marketplace state:', error);
    return {
      merchantTarget: Number(process.env.MERCHANT_TARGET || 10),
      currentMerchants: 0,
      ownerShare: 100,
      vendorShare: 0,
      stage: 'Owner-led launch',
      message: 'Unable to calculate marketplace state'
    };
  }
};

// GET /api/products - Get all products
app.get('/api/products', async (_req, res) => {
  try {
    const products = await Product.find({}).populate('vendorId', 'name category');
    const marketplace = await getMarketplaceState();

    res.json({
      success: true,
      products,
      marketplace
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

app.get('/api/products/meta/categories', async (_req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json({ success: true, categories: categories.filter(Boolean).sort() });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

app.get('/api/products/search/:query', async (req, res) => {
  try {
    const query = String(req.params.query || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } }
      ]
    }).limit(limit);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ success: false, message: 'Error searching products' });
  }
});

// POST /api/products - Create a new product
app.post('/api/products', async (req, res) => {
  try {
    const {
      name,
      productType,
      deliveryType,
      category,
      price,
      originalPrice,
      image,
      description,
      seller,
      featured,
      vendorId,
      vendorCommissionRate,
      consumable,
      warrantyEligible,
      campaignType,
      campaignValue
    } = req.body;

    // Validate required fields
    if (!name || !category || !price) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, category, price'
      });
    }

    // If vendorId is provided, verify it exists
    if (vendorId) {
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }
    }

    const product = new Product({
      name,
      productType: productType || 'physical',
      deliveryType: deliveryType || 'shipped',
      category,
      price,
      originalPrice: originalPrice || price,
      image: image || null,
      description: description || '',
      seller: seller || (vendorId ? 'Vendor' : 'Yow by KSA'),
      featured: featured || false,
      vendorId: vendorId || null,
      vendorCommissionRate: vendorCommissionRate || 0,
      consumable: Boolean(consumable),
      warrantyEligible: Boolean(warrantyEligible),
      campaignType: campaignType || 'none',
      campaignValue: campaignValue || 0
    });

    await product.save();
    const marketplace = await getMarketplaceState();

    res.status(201).json({
      success: true,
      product,
      marketplace
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// GET /api/marketplace - Get marketplace stats
app.get('/api/marketplace', async (_req, res) => {
  try {
    const marketplace = await getMarketplaceState();
    const approvedVendors = await Vendor.countDocuments({ status: 'approved' });
    const vendorProducts = await Product.countDocuments({ vendorId: { $ne: null } });
    const ownerProducts = await Product.countDocuments({ vendorId: null });
    const platformRevenue = await PlatformRevenue.findOne();

    res.json({
      success: true,
      marketplace: {
        ...marketplace,
        totalVendorProducts: vendorProducts,
        totalOwnerProducts: ownerProducts,
        merchantCount: approvedVendors,
        platformRevenue: platformRevenue ? {
          totalCommissionsEarned: platformRevenue.totalCommissionsEarned,
          totalOwnerProductSales: platformRevenue.totalOwnerProductSales,
          totalVendorSales: platformRevenue.totalVendorSales
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching marketplace stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching marketplace stats',
      error: error.message
    });
  }
});

// POST /api/orders - Create a new order
app.post('/api/orders', optionalAuthenticateUser, async (req, res) => {
  const reservedInventory = [];
  let orderSaved = false;
  try {
    const { items, customer, shippingAddress, paymentMethod, notes, giftWrap, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone are required'
      });
    }

    if (!shippingAddress || !shippingAddress.region || !shippingAddress.city || !shippingAddress.address) {
      return res.status(400).json({ success: false, message: 'Complete shipping address is required' });
    }

    if (!['cod', 'bkash', 'nagad', 'rocket'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'A valid payment method is required' });
    }

    const requestedQuantities = new Map();
    for (const item of items) {
      const productId = String(item.productId || '');
      const quantity = Number(item.quantity);
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: 'Each item must have a valid product identifier' });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({ success: false, message: 'Each item quantity must be a whole number from 1 to 99' });
      }
      const combinedQuantity = (requestedQuantities.get(productId) || 0) + quantity;
      if (combinedQuantity > 99) {
        return res.status(400).json({ success: false, message: 'The total quantity for a product cannot exceed 99' });
      }
      requestedQuantities.set(productId, combinedQuantity);
    }

    const enrichedItems = [];
    for (const [productId, quantity] of requestedQuantities) {
      const product = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );
      if (!product) {
        const productExists = await Product.exists({ _id: productId });
        await Promise.allSettled(reservedInventory.map(reservation =>
          Product.updateOne({ _id: reservation.productId }, { $inc: { stock: reservation.quantity } })
        ));
        reservedInventory.length = 0;
        return res.status(productExists ? 409 : 404).json({
          success: false,
          message: productExists ? 'An item is temporarily unavailable or has insufficient stock' : 'A product in your cart is no longer available'
        });
      }

      reservedInventory.push({ productId, quantity, stock: product.stock });
      enrichedItems.push({
        productId,
        quantity,
        price: product.price,
        vendorId: product.vendorId || null,
        vendorCommissionRate: product.vendorCommissionRate || 0
      });
    }

    const merchandiseTotal = enrichedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
    const user = req.user ? await User.findById(req.user.id) : null;
    const loyal = Boolean(user && user.loyaltyMonths >= 2);
    const subscriber = Boolean(user && user.isSubscriber && user.subscriptionRenewsAt > new Date());
    const shippingFee = 100;
    const giftWrapFee = giftWrap ? 50 : 0;
    const coupon = String(couponCode || '').trim().toUpperCase();
    let discount = 0;
    let finalShippingFee = shippingFee;
    if (coupon === 'FLASH20' && merchandiseTotal >= 2000) discount = Math.round(merchandiseTotal * 0.2);
    if (coupon === 'WELCOME10') discount = Math.round(merchandiseTotal * 0.1);
    if (coupon === 'BULK15' && enrichedItems.reduce((sum, item) => sum + item.quantity, 0) >= 3) {
      discount = Math.round(merchandiseTotal * 0.15);
    }
    if (coupon === 'SAVE500' && merchandiseTotal >= 5000) discount = Math.min(500, merchandiseTotal);
    if (coupon === 'FREESHIP' && merchandiseTotal >= 3000) finalShippingFee = 0;
    const benefitDiscount = loyal && user.loyaltyDiscountCap > 0
      ? Math.min(Math.round(merchandiseTotal * (user.loyaltyDiscountCap / 100)), merchandiseTotal - discount)
      : 0;
    if (merchandiseTotal >= 3000 || itemCount >= 5 || loyal || subscriber) finalShippingFee = 0;
    const total = Math.max(0, merchandiseTotal - discount - benefitDiscount + finalShippingFee + giftWrapFee);
    const order = new Order({
      userId: req.user?.id || null,
      items: enrichedItems,
      customer,
      shippingAddress,
      paymentMethod,
      notes,
      giftWrap: Boolean(giftWrap),
      couponCode: coupon || null,
      benefitDiscount,
      shippingFee: finalShippingFee,
      subscriberOrder: subscriber,
      inventoryReserved: true,
      total,
      status: 'pending'
    });

    await order.save();
    orderSaved = true;
    const marketplace = await getMarketplaceState();

    res.status(201).json({
      success: true,
      order,
      inventory: reservedInventory.map(({ productId, stock }) => ({ productId, stock })),
      rewards: null,
      marketplace
    });
  } catch (error) {
    if (!orderSaved && reservedInventory.length) {
      await Promise.allSettled(reservedInventory.map(reservation =>
        Product.updateOne({ _id: reservation.productId }, { $inc: { stock: reservation.quantity } })
      ));
    }
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

app.post('/api/orders/cod', async (req, res) => {
  req.body.paymentMethod = 'cod';
  return optionalAuthenticateUser(req, res, () => {
    req.url = '/api/orders';
    return app._router.handle(req, res, () => {});
  });
});

app.post('/api/orders/:id/cancel', adminAuth, async (req, res) => {
  if (!databaseReady) return res.status(503).json({ success: false, message: 'Database is unavailable' });
  const session = await mongoose.startSession();
  let cancelledOrder;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      if (order.status !== 'pending') throw Object.assign(new Error('Only pending orders can be cancelled'), { statusCode: 409 });

      if (order.inventoryReserved) {
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
        order.inventoryReserved = false;
      }

      if (order.rewardsApplied) {
        const points = Math.floor(order.total / 100) * 10;
        if (order.userId && points) {
          await User.updateOne({ _id: order.userId }, { $inc: { loyaltyPoints: -points } }, { session });
        }
        if (order.total >= 3000) {
          if (order.userId) {
            await User.updateOne({ _id: order.userId }, { $inc: { raffleTokens: -1 } }, { session });
          }
          await RaffleEntry.deleteMany({ orderId: order._id }, { session });
        }
        order.rewardsApplied = false;
      }

      order.status = 'cancelled';
      await order.save({ session });
      cancelledOrder = order;
    });

    res.json({ success: true, message: 'Pending order cancelled and reserved stock released', order: cancelledOrder });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Unable to cancel order' });
  } finally {
    await session.endSession();
  }
});

app.get('/api/orders/my-orders', authenticateUser, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch order history' });
  }
});

// GET /api/orders/:id - Get order details
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId').populate('items.vendorId');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

// POST /api/orders/:id/complete - Complete an order and calculate commissions
app.post('/api/orders/:id/complete', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order already completed'
      });
    }
    if (order.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'A cancelled order cannot be completed' });
    }

    // Get platform revenue
    let platformRevenue = await PlatformRevenue.findOne();
    if (!platformRevenue) {
      platformRevenue = await PlatformRevenue.create({
        totalCommissionsEarned: 0,
        totalOwnerProductSales: 0,
        totalVendorSales: 0,
        transactionHistory: []
      });
    }

    // Process commission for each item
    for (const item of order.items) {
      const itemTotal = item.price * item.quantity;

      if (item.vendorId) {
        // Vendor product - calculate commission
        const commission = itemTotal * (item.vendorCommissionRate / 100);
        const vendorRevenue = itemTotal - commission;

        // Update vendor stats
        await Vendor.findByIdAndUpdate(item.vendorId, {
          $inc: {
            totalSales: vendorRevenue,
            totalCommissionEarned: commission
          }
        });

        // Record in platform revenue
        platformRevenue.totalCommissionsEarned += commission;
        platformRevenue.totalVendorSales += vendorRevenue;
        platformRevenue.transactionHistory.push({
          orderId: order._id,
          type: 'commission',
          amount: commission,
          vendorId: item.vendorId
        });
      } else {
        // Owner product - all revenue goes to Yow by KSA
        platformRevenue.totalOwnerProductSales += itemTotal;
        platformRevenue.transactionHistory.push({
          orderId: order._id,
          type: 'owner_sale',
          amount: itemTotal
        });
      }
    }

    // Update order status
    order.status = 'completed';
    order.completedAt = new Date();
    await order.save();
    const rewards = await applyOrderRewards(order);

    // Save platform revenue
    await platformRevenue.save();

    res.json({
      success: true,
      message: 'Order completed successfully and commissions calculated',
      order,
      rewards,
      commissionsSummary: {
        totalCommissionsEarned: platformRevenue.totalCommissionsEarned,
        totalOwnerProductSales: platformRevenue.totalOwnerProductSales,
        totalVendorSales: platformRevenue.totalVendorSales
      }
    });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing order',
      error: error.message
    });
  }
});

// Fallback route for SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Yow by KSA marketplace running on port ${PORT}`);
});
