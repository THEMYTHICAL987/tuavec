const express = require('express');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();
const imageSearchLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Image search limit reached. Try again in a minute.' }
});

const PRODUCT_FIELDS = [
  'sku', 'name', 'title', 'brand', 'category', 'size', 'description',
  'price', 'originalPrice', 'priceBDT', 'stock', 'inStock', 'image',
  'imageUrl', 'images', 'featured', 'campaignType', 'campaignValue',
  'updatedAt'
].join(' ');

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isDatabaseReady = () => mongoose.connection.readyState === 1;

function normalizeProductUpdate(body, product) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('A product update object is required.'), { statusCode: 400 });
  }

  const update = {};
  for (const field of ['name', 'title', 'brand', 'category', 'size', 'description']) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || body[field].trim().length > (field === 'description' ? 5000 : 200)) {
      throw Object.assign(new Error(`${field} must be text within the allowed length.`), { statusCode: 400 });
    }
    update[field] = body[field].trim();
  }

  if (update.name && body.title === undefined) update.title = update.name;
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      throw Object.assign(new Error('Stock must be a whole number from 0 to 1,000,000.'), { statusCode: 400 });
    }
    update.stock = stock;
    update.inStock = stock > 0;
  }

  const currentBasePrice = Number(product.originalPrice ?? product.priceBDT ?? product.price);
  const basePrice = body.price === undefined ? currentBasePrice : Number(body.price);
  if (!Number.isFinite(basePrice) || basePrice < 0 || basePrice > 100000000) {
    throw Object.assign(new Error('Price must be a valid non-negative amount.'), { statusCode: 400 });
  }

  const campaignType = body.campaignType === undefined
    ? (product.campaignType || 'none')
    : body.campaignType;
  const campaignValue = body.campaignValue === undefined
    ? (Number(product.campaignValue) || 0)
    : Number(body.campaignValue);

  if (!['none', 'percentage'].includes(campaignType)) {
    throw Object.assign(new Error('Only no-discount and percentage campaigns are supported in checkout.'), { statusCode: 400 });
  }
  if (campaignType === 'percentage' && (!Number.isFinite(campaignValue) || campaignValue < 1 || campaignValue > 80)) {
    throw Object.assign(new Error('Percentage campaigns must be between 1% and 80%.'), { statusCode: 400 });
  }

  update.originalPrice = basePrice;
  update.priceBDT = basePrice;
  update.price = campaignType === 'percentage'
    ? Math.round(basePrice * (1 - campaignValue / 100))
    : basePrice;
  update.campaignType = campaignType;
  update.campaignValue = campaignType === 'percentage' ? campaignValue : 0;

  if (body.featured !== undefined) {
    if (typeof body.featured !== 'boolean') {
      throw Object.assign(new Error('Featured must be true or false.'), { statusCode: 400 });
    }
    update.featured = body.featured;
  }

  if (body.imageUrl !== undefined) {
    if (body.imageUrl === null || body.imageUrl === '') {
      update.imageUrl = null;
      update.image = null;
      update.images = [];
    } else {
      let imageUrl;
      try {
        imageUrl = new URL(body.imageUrl);
      } catch {
        throw Object.assign(new Error('Image URL must be a valid HTTPS URL.'), { statusCode: 400 });
      }
      if (imageUrl.protocol !== 'https:' || imageUrl.href.length > 2048) {
        throw Object.assign(new Error('Image URL must use HTTPS and be no longer than 2,048 characters.'), { statusCode: 400 });
      }
      update.imageUrl = imageUrl.href;
      update.image = imageUrl.href;
      update.images = [{ url: imageUrl.href }];
    }
  }

  return update;
}

function normalizeStockRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) {
    throw Object.assign(new Error('Provide 1 to 1,000 stock rows.'), { statusCode: 400 });
  }

  const seen = new Set();
  return rows.map((row, index) => {
    const sku = String(row?.sku || '').trim().toUpperCase();
    const stock = Number(row?.stock);
    if (!sku || sku.length > 80 || !Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      throw Object.assign(new Error(`Stock row ${index + 1} needs a SKU and a whole-number stock value from 0 to 1,000,000.`), { statusCode: 400 });
    }
    if (seen.has(sku)) {
      throw Object.assign(new Error(`Duplicate SKU in stock upload: ${sku}.`), { statusCode: 400 });
    }
    seen.add(sku);
    return { sku, stock };
  });
}

router.use(adminAuth);

router.get('/dashboard', async (_req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  try {
    const [products, outOfStock, missingImages, activeCampaigns, orderStatuses, recentOrders] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ stock: 0 }),
      Product.countDocuments({ $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }] }),
      Product.countDocuments({ campaignType: 'percentage', campaignValue: { $gt: 0 } }),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.find().sort({ createdAt: -1 }).limit(8).select('customer total status createdAt paymentMethod').lean()
    ]);
    res.json({
      success: true,
      metrics: {
        products,
        outOfStock,
        missingImages,
        activeCampaigns,
        orders: orderStatuses.reduce((result, row) => ({ ...result, [row._id]: row.count }), {})
      },
      recentOrders
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Unable to load operations dashboard.' });
  }
});

router.get('/products', async (req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const filter = {};
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { sku: pattern }, { name: pattern }, { title: pattern },
        { brand: pattern }, { category: pattern }
      ];
    }
    if (req.query.missingImage === 'true') {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }] }
      ];
    }
    if (req.query.stock === 'out') filter.stock = 0;
    if (req.query.stock === 'available') filter.stock = { $gt: 0 };

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).select(PRODUCT_FIELDS).sort({ category: 1, brand: 1, title: 1 })
        .skip((page - 1) * limit).limit(limit).lean()
    ]);
    res.json({ success: true, page, limit, total, products });
  } catch (error) {
    console.error('Admin product list error:', error);
    res.status(500).json({ success: false, message: 'Unable to load products.' });
  }
});

router.patch('/products/:id', async (req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid product identifier.' });
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    product.set(normalizeProductUpdate(req.body, product));
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    if (status === 500) console.error('Admin product update error:', error);
    res.status(status).json({ success: false, message: status === 500 ? 'Unable to update product.' : error.message });
  }
});

router.post('/inventory/import', async (req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  try {
    const rows = normalizeStockRows(req.body?.rows);
    const existing = await Product.find({ sku: { $in: rows.map(row => row.sku) } }).select('sku').lean();
    const existingSkus = new Set(existing.map(product => product.sku));
    const applicableRows = rows.filter(row => existingSkus.has(row.sku));
    if (applicableRows.length) {
      await Product.bulkWrite(applicableRows.map(({ sku, stock }) => ({
        updateOne: {
          filter: { sku },
          update: { $set: { stock, inStock: stock > 0 } }
        }
      })));
    }
    res.json({
      success: true,
      updated: applicableRows.length,
      unknownSkus: rows.filter(row => !existingSkus.has(row.sku)).map(row => row.sku)
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('Admin stock import error:', error);
    res.status(status).json({ success: false, message: status === 500 ? 'Unable to import stock.' : error.message });
  }
});

router.post('/products/:id/image-search', imageSearchLimit, async (req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid product identifier.' });
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const engineId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !engineId) {
    return res.status(503).json({
      success: false,
      message: 'Image search is not configured. Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to the backend environment.'
    });
  }

  try {
    const product = await Product.findById(req.params.id).select('sku brand name title').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.search = new URLSearchParams({
      key: apiKey,
      cx: engineId,
      q: `${product.brand || ''} ${product.title || product.name} official product`.trim(),
      searchType: 'image',
      imgSize: 'large',
      safe: 'active',
      num: '8',
      fields: 'items(link,title,image(thumbnailLink,width,height))'
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      console.error(`Google image search failed with HTTP ${response.status}.`);
      return res.status(502).json({ success: false, message: 'Image search provider returned an error.' });
    }
    const data = await response.json();
    const candidates = (data.items || []).flatMap(item => {
      try {
        const imageUrl = new URL(item.link);
        const width = Number(item.image?.width) || 0;
        const height = Number(item.image?.height) || 0;
        if (imageUrl.protocol !== 'https:' || imageUrl.href.length > 2048 || width < 500 || height < 500) return [];
        return [{
          url: imageUrl.href,
          title: String(item.title || '').slice(0, 240),
          thumbnail: item.image?.thumbnailLink || null,
          width,
          height
        }];
      } catch {
        return [];
      }
    });
    res.json({ success: true, sku: product.sku, candidates });
  } catch (error) {
    console.error('Admin image search error:', error);
    res.status(500).json({ success: false, message: 'Unable to search for product images.' });
  }
});

router.get('/orders', async (req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const filter = {};
    if (typeof req.query.status === 'string' && req.query.status !== 'all') filter.status = req.query.status;
    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('customer items total status paymentMethod shippingAddress createdAt').lean()
    ]);
    res.json({ success: true, page, limit, total, orders });
  } catch (error) {
    console.error('Admin order list error:', error);
    res.status(500).json({ success: false, message: 'Unable to load orders.' });
  }
});

router.patch('/orders/:id/status', async (req, res) => {
  if (!isDatabaseReady()) return res.status(503).json({ success: false, message: 'Database is unavailable.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid order identifier.' });
  const allowedTransitions = {
    pending: 'confirmed',
    confirmed: 'shipped',
    shipped: 'delivered'
  };
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (allowedTransitions[order.status] !== req.body?.status) {
      return res.status(409).json({ success: false, message: 'Only pending → confirmed → shipped → delivered transitions are allowed here.' });
    }
    order.status = req.body.status;
    await order.save();
    res.json({ success: true, order });
  } catch (error) {
    console.error('Admin order status update error:', error);
    res.status(500).json({ success: false, message: 'Unable to update order status.' });
  }
});

router.normalizeProductUpdate = normalizeProductUpdate;
router.normalizeStockRows = normalizeStockRows;

module.exports = router;
