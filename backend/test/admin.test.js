const assert = require('node:assert/strict');
const test = require('node:test');
const adminAuth = require('../middleware/auth').adminAuth;
const { normalizeProductUpdate, normalizeStockRows } = require('../routes/admin');

const product = {
  originalPrice: 1000,
  priceBDT: 1000,
  price: 1000,
  campaignType: 'none',
  campaignValue: 0
};

test('applies a percentage campaign to the base retail price', () => {
  const update = normalizeProductUpdate({
    price: 2000,
    campaignType: 'percentage',
    campaignValue: 20,
    stock: 5
  }, product);

  assert.equal(update.originalPrice, 2000);
  assert.equal(update.priceBDT, 2000);
  assert.equal(update.price, 1600);
  assert.equal(update.stock, 5);
  assert.equal(update.inStock, true);
});

test('removing a campaign restores its base price and prevents sales without stock', () => {
  const update = normalizeProductUpdate({
    campaignType: 'none',
    stock: 0
  }, {
    originalPrice: 2000,
    priceBDT: 2000,
    price: 1600,
    campaignType: 'percentage',
    campaignValue: 20
  });

  assert.equal(update.price, 2000);
  assert.equal(update.campaignValue, 0);
  assert.equal(update.inStock, false);
});

test('rejects unsupported campaigns, invalid stock, and non-HTTPS product images', () => {
  assert.throws(
    () => normalizeProductUpdate({ campaignType: 'bogo', campaignValue: 1 }, product),
    /Only no-discount and percentage campaigns/
  );
  assert.throws(
    () => normalizeProductUpdate({ campaignType: 'percentage', campaignValue: 81 }, product),
    /between 1% and 80%/
  );
  assert.throws(
    () => normalizeProductUpdate({ stock: -1 }, product),
    /Stock must be a whole number/
  );
  assert.throws(
    () => normalizeProductUpdate({ imageUrl: 'http://example.com/image.jpg' }, product),
    /HTTPS/
  );
});

test('normalizes bulk stock rows and rejects duplicates', () => {
  assert.deepEqual(normalizeStockRows([
    { sku: ' inni-ret-01 ', stock: '12' },
    { sku: 'COVE-MILK-01', stock: 0 }
  ]), [
    { sku: 'INNI-RET-01', stock: 12 },
    { sku: 'COVE-MILK-01', stock: 0 }
  ]);
  assert.throws(
    () => normalizeStockRows([{ sku: 'same-01', stock: 2 }, { sku: 'SAME-01', stock: 3 }]),
    /Duplicate SKU/
  );
});

test('admin authentication fails closed when its configured token is missing', () => {
  const previousToken = process.env.ADMIN_TOKEN;
  delete process.env.ADMIN_TOKEN;
  let statusCode;
  let message;
  const response = {
    status(code) { statusCode = code; return this; },
    json(body) { message = body.message; return this; }
  };

  try {
    adminAuth({ headers: { 'x-admin-token': 'admin-secret-key-change-in-production' } }, response, () => {
      assert.fail('Admin middleware must not accept a hard-coded fallback token.');
    });
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previousToken;
  }
  assert.equal(statusCode, 403);
  assert.match(message, /not configured/);
});

test('admin authentication accepts a matching configured token', () => {
  const previousToken = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'test-admin-token-that-is-long-enough';
  let authorized = false;
  try {
    adminAuth({ headers: { 'x-admin-token': process.env.ADMIN_TOKEN } }, {
      status() { return this; },
      json(body) { assert.fail(body.message); }
    }, () => { authorized = true; });
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previousToken;
  }
  assert.equal(authorized, true);
});
