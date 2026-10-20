const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  buildProductDocument,
  buildLegacyDemoFilter,
  LEGACY_DEMO_SKUS,
  LEGACY_DEMO_SLUGS,
  parsePlainText,
  readCatalog
} = require('../scripts/seedProducts');

const headers = [
  'SKU',
  'Brand',
  'Product Name',
  'Category',
  'Size/Volume',
  'Target Concern / Description',
  'Estimated Cost (THB)',
  'Estimated Retail (BDT)'
];

test('reads and validates the supplied full catalog', async () => {
  const catalogPath = path.resolve(__dirname, '..', '..', 'beautyandskincareproducts.txt');
  const products = await readCatalog(catalogPath);

  assert.equal(products.length, 349);
  assert.deepEqual(
    products.find(product => product.sku === 'COVE-MILK-01'),
    {
      sku: 'COVE-MILK-01',
      brand: 'Covermark',
      title: 'Treatment Cleansing Milk L',
      category: 'Skincare',
      size: '400g',
      description: 'Moisturizing milk cleanser for dry skin',
      priceTHB: 1800,
      priceBDT: 7600,
      sourceLine: 929
    }
  );
  const innisfree = products.find(product => product.sku === 'INNI-RET-01');
  assert.equal(innisfree.priceTHB, 1350);
  assert.equal(innisfree.priceBDT, 5700);
});

test('parses quoted CSV rows with commas in text fields', () => {
  const row = [
    'AB-12',
    '"Brand, Inc."',
    '"Serum, Night Repair"',
    'Skincare',
    '30ml',
    '"Helps skin, including dry skin"',
    '"1,200"',
    '"4,500"'
  ].join(',');
  const products = parsePlainText(`${headers.join(',')}\n${row}`, 'catalog.csv');

  assert.equal(products.length, 1);
  assert.equal(products[0].brand, 'Brand, Inc.');
  assert.equal(products[0].title, 'Serum, Night Repair');
  assert.equal(products[0].description, 'Helps skin, including dry skin');
  assert.equal(products[0].priceTHB, 1200);
  assert.equal(products[0].priceBDT, 4500);
});

test('rejects incomplete and duplicate catalog records', () => {
  const record = ['AB-12', 'Brand', 'Serum', 'Skincare', '30ml', 'Hydrating', '100', '200'];
  assert.throws(
    () => parsePlainText([...headers, ...record.slice(0, 4)].join('\r'), 'incomplete.txt'),
    /only 4 of 8 fields/
  );
  assert.throws(
    () => parsePlainText([...headers, ...record, ...record].join('\r'), 'duplicate.txt'),
    /duplicate SKU "AB-12"/
  );
});

test('maps catalog data into the app schema without inventing inventory', () => {
  const document = buildProductDocument({
    sku: 'AB-12',
    brand: 'Brand',
    title: 'Serum',
    category: 'Skincare',
    size: '30ml',
    description: 'Hydrating serum',
    priceTHB: 100,
    priceBDT: 200
  }, 'https://example.com/serum.jpg');

  assert.equal(document.sku, 'AB-12');
  assert.equal(document.priceTHB, 100);
  assert.equal(document.priceBDT, 200);
  assert.equal(document.price, 200);
  assert.equal(document.imageUrl, 'https://example.com/serum.jpg');
  assert.equal(document.stock, 0);
  assert.equal(document.inStock, false);
  assert.deepEqual(document.images, [{ url: 'https://example.com/serum.jpg' }]);

  const withoutImage = buildProductDocument({
    sku: 'AB-13',
    brand: 'Brand',
    title: 'Cleanser',
    category: 'Skincare',
    size: '100ml',
    description: 'Gentle cleanser',
    priceTHB: 100,
    priceBDT: 200
  }, null);
  assert.equal(withoutImage.imageUrl, null);
  assert.deepEqual(withoutImage.images, []);
  assert.equal(withoutImage.stock, 0);
  assert.equal(withoutImage.inStock, false);
});

test('limits demo cleanup to known legacy products and protects catalog matches', () => {
  const filter = buildLegacyDemoFilter([{ sku: 'TU-KR-SERUM-001' }, { sku: 'NEW-SKU-01' }]);

  assert.deepEqual(LEGACY_DEMO_SKUS, [
    'TU-KR-SERUM-001',
    'TU-KR-LIP-TINT-001',
    'TU-CHOC-DARK-001'
  ]);
  assert.equal(LEGACY_DEMO_SLUGS.includes('korean-hydrating-serum'), true);
  assert.deepEqual(filter, {
    $and: [
      {
        $or: [
          { slug: { $in: LEGACY_DEMO_SLUGS } },
          { sku: { $in: LEGACY_DEMO_SKUS } }
        ]
      },
      { sku: { $nin: ['TU-KR-SERUM-001', 'NEW-SKU-01'] } },
      { slug: { $nin: ['tu-kr-serum-001', 'new-sku-01'] } }
    ]
  });
});
