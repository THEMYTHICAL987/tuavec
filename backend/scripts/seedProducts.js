/**
 * seedProducts.js
 *
 * Reads a product catalog from a .txt export,
 * validates rows, fetches an official product image via Google Custom Search,
 * and seeds a MongoDB collection using Mongoose.
 *
 * Usage:
 *   node backend/scripts/seedProducts.js --file beautyandskincareproducts.txt
 *   node backend/scripts/seedProducts.js --dry-run --file catalog.csv
 */
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { parse: parseCsv } = require('csv-parse/sync');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Product = require('../models/Product');
const DEFAULT_CATALOG_PATH = path.resolve(__dirname, '..', '..', 'beautyandskincareproducts.txt');
const HEADERS = [
  'sku',
  'brand',
  'productname',
  'category',
  'sizevolume',
  'targetconcerndescription',
  'estimatedcostthb',
  'estimatedretailbdt'
];
const LEGACY_DEMO_SLUGS = [
  'school-operations-starter-pack',
  'office-admin-hr-template-vault',
  'small-business-cashflow-inventory-dashboard',
  'bangladesh-ngo-reporting-toolkit',
  'bengali-english-business-writing-pack',
  'frontline-customer-service-training-microcourse',
  'digital-safety-scam-awareness-workshop-kit',
  'team-productivity-meeting-system',
  'tuavec-business-digital-starter-bundle',
  'korean-hydrating-serum',
  'korean-velvet-lip-tint',
  'imported-dark-chocolate-bar'
];
const LEGACY_DEMO_SKUS = [
  'TU-KR-SERUM-001',
  'TU-KR-LIP-TINT-001',
  'TU-CHOC-DARK-001'
];
// Used to detect a new record in the line-per-field format when a row is incomplete.
const SKU_BOUNDARY_PATTERN = /^(?=.*-)[A-Z0-9][A-Z0-9'&.]*(?:-[A-Z0-9'&.]*)*\d$/i;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const GOOGLE_CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

class CatalogError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'CatalogError';
    this.errors = errors;
  }
}

class HttpError extends Error {
  constructor(statusCode, retryAfter) {
    super(`Image search returned HTTP ${statusCode}.`);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

// Trim and compact whitespace so the parser can compare table cells reliably.
function normalizeCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value) {
  return normalizeCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isHeaderRow(cells) {
  return cells.length === HEADERS.length
    && cells.every((cell, index) => normalizeHeader(cell) === HEADERS[index]);
}

function isHeaderAt(cells, index) {
  return index + HEADERS.length <= cells.length
    && isHeaderRow(cells.slice(index, index + HEADERS.length).map(cell => cell.value));
}

function parsePrice(value, fieldName, sourceLine, errors) {
  const normalized = normalizeCell(value);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) {
    errors.push(`Line/row ${sourceLine}: ${fieldName} must be a non-negative number (received "${value}").`);
    return null;
  }

  const price = Number(normalized.replace(/,/g, ''));
  if (!Number.isFinite(price)) {
    errors.push(`Line/row ${sourceLine}: ${fieldName} is outside the supported numeric range.`);
    return null;
  }
  return price;
}

function validateProduct(cells, sourceLine, errors) {
  const [sku, brand, name, category, size, description, costText, retailText] = cells;
  const productStart = errors.length;

  for (const [field, value] of [
    ['SKU', sku],
    ['Brand', brand],
    ['Product Name', name],
    ['Category', category],
    ['Size/Volume', size],
    ['Target Concern / Description', description]
  ]) {
    if (!normalizeCell(value)) errors.push(`Line/row ${sourceLine}: ${field} is required.`);
  }

  const priceTHB = parsePrice(costText, 'Estimated Cost (THB)', sourceLine, errors);
  const priceBDT = parsePrice(retailText, 'Estimated Retail (BDT)', sourceLine, errors);
  if (errors.length !== productStart) return null;

  return {
    sku: sku.toUpperCase(),
    brand,
    title: name,
    category,
    size,
    description,
    priceTHB,
    priceBDT,
    sourceLine
  };
}

// Parse a two-dimensional table (from Word/Excel export or textual table rows).
function parseTableRows(rows, sourceName) {
  const products = [];
  const errors = [];

  rows.forEach((row, index) => {
    const cells = row.cells.map(normalizeCell);
    if (cells.every(cell => !cell)) return;
    if (isHeaderRow(cells)) return;

    if (cells.length !== HEADERS.length || cells.some(cell => !cell)) {
      errors.push(`${sourceName}, row ${row.line || index + 1}: expected exactly 8 non-empty fields.`);
      return;
    }

    const product = validateProduct(cells, row.line || index + 1, errors);
    if (product) products.push(product);
  });

  validateUniqueSkus(products, errors, sourceName);
  throwCatalogErrors(sourceName, errors);
  return products;
}

// The attachment is a .txt export with one field per line, not a true CSV/TSV.
// Each product appears as a repeating 8-field sequence: SKU, Brand, Product Name, etc.
function parseCellStream(lines, sourceName) {
  const cells = lines
    .map((value, index) => ({ value: normalizeCell(value), line: index + 1 }))
    .filter(cell => cell.value);
  const products = [];
  const errors = [];
  let cursor = 0;

  while (cursor < cells.length) {
    if (isHeaderAt(cells, cursor)) {
      cursor += HEADERS.length;
      continue;
    }

    const start = cells[cursor];
    if (start.value.includes(',') && SKU_BOUNDARY_PATTERN.test(start.value.split(',', 1)[0])) {
      const csvRecord = parseCsv(start.value, {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true
      })[0];
      if (csvRecord.length !== HEADERS.length) {
        errors.push(`${sourceName}, line ${start.line}: expected 8 fields in the inline CSV record.`);
      } else {
        const product = validateProduct(csvRecord.map(normalizeCell), start.line, errors);
        if (product) products.push(product);
      }
      cursor += 1;
      continue;
    }

    const record = [];
    const recordStartLine = start.line;
    record.push(start.value);
    cursor += 1;
    while (record.length < HEADERS.length && cursor < cells.length) {
      if (isHeaderAt(cells, cursor)) {
        cursor += HEADERS.length;
        continue;
      }

      const current = cells[cursor];
      if (SKU_BOUNDARY_PATTERN.test(current.value)) {
        errors.push(`${sourceName}, line ${recordStartLine}: SKU "${record[0]}" has only ${record.length} of 8 fields before the next SKU.`);
        break;
      }

      record.push(current.value);
      cursor += 1;
    }

    if (record.length !== HEADERS.length) {
      if (cursor >= cells.length) {
        errors.push(`${sourceName}, line ${recordStartLine}: SKU "${record[0]}" has only ${record.length} of 8 fields.`);
      }
      continue;
    }

    const product = validateProduct(record, recordStartLine, errors);
    if (product) products.push(product);
  }

  validateUniqueSkus(products, errors, sourceName);
  throwCatalogErrors(sourceName, errors);
  return products;
}

function validateUniqueSkus(products, errors, sourceName) {
  const seen = new Map();
  for (const product of products) {
    const previousLine = seen.get(product.sku);
    if (previousLine) {
      errors.push(`${sourceName}, line ${product.sourceLine}: duplicate SKU "${product.sku}" (first seen on line ${previousLine}).`);
    } else {
      seen.set(product.sku, product.sourceLine);
    }
  }
}

function throwCatalogErrors(sourceName, errors) {
  if (errors.length === 0) return;
  const shown = errors.slice(0, 25).map(error => `- ${error}`).join('\n');
  const remainder = errors.length > 25 ? `\n- ...and ${errors.length - 25} more error(s).` : '';
  throw new CatalogError(`Catalog validation failed for ${sourceName}:\n${shown}${remainder}`, errors);
}

function splitCatalogLines(text) {
  return text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
}

function parseDelimitedText(text, sourceName, delimiter) {
  let records;
  try {
    records = parseCsv(text, {
      bom: true,
      delimiter,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (error) {
    throw new CatalogError(`Could not parse delimited catalog ${sourceName}: ${error.message}`);
  }
  const rows = records.map((cells, index) => ({ cells, line: index + 1 }));
  return parseTableRows(rows, sourceName);
}

function parsePlainText(text, sourceName) {
  const normalized = text.replace(/^\uFEFF/, '');
  const lines = splitCatalogLines(normalized);
  const firstNonEmptyLine = lines.find(line => normalizeCell(line));
  if (firstNonEmptyLine) {
    const delimiter = firstNonEmptyLine.includes('\t') ? '\t' : ',';
    const delimiterCount = firstNonEmptyLine.split(delimiter).length - 1;
    if (delimiterCount >= HEADERS.length - 1) {
      return parseDelimitedText(normalized, sourceName, delimiter);
    }
  }
  return parseCellStream(lines, sourceName);
}

function decodeCatalog(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

async function readCatalog(catalogPath) {
  const extension = path.extname(catalogPath).toLowerCase();
  if (!['.txt', '.csv', '.tsv'].includes(extension)) {
    throw new Error(`Unsupported catalog type "${extension}". Use a .txt, .csv, or .tsv file.`);
  }
  return parsePlainText(decodeCatalog(fs.readFileSync(catalogPath)), catalogPath);
}

// Respect a minimum delay between image lookups to avoid being rate-limited.
function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// Make a Google CSE request and surface HTTP + timeout errors cleanly.
function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 15000 }, response => {
      const chunks = [];
      let responseSize = 0;

      response.on('data', chunk => {
        responseSize += chunk.length;
        if (responseSize > 2 * 1024 * 1024) {
          request.destroy(new Error('Image search response exceeded 2 MB.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new HttpError(response.statusCode, response.headers['retry-after']));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new Error('Image search returned invalid JSON.'));
        }
      });
    });

    request.on('timeout', () => request.destroy(new Error('Image search request timed out.')));
    request.on('error', reject);
  });
}

function retryDelay(error, attempt) {
  const retryAfterSeconds = Number(error.retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 60000);
  }
  return Math.min(1000 * (2 ** attempt) + Math.floor(Math.random() * 250), 60000);
}

// Search for a clean, high-resolution product image while honoring a per-request delay.
async function fetchImageResult(product, options) {
  const searchUrl = new URL(GOOGLE_CSE_ENDPOINT);
  searchUrl.search = new URLSearchParams({
    key: options.apiKey,
    cx: options.engineId,
    q: `${product.brand} ${product.title} official product image`,
    searchType: 'image',
    imgSize: 'large',
    safe: 'active',
    num: '10',
    fields: 'items(link,title,image(contextLink,width,height))'
  }).toString();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const elapsed = Date.now() - options.lastRequestAt;
    if (elapsed < options.rateLimitMs) await sleep(options.rateLimitMs - elapsed);
    options.lastRequestAt = Date.now();

    try {
      return await requestJson(searchUrl);
    } catch (error) {
      const canRetry = error instanceof HttpError
        && RETRYABLE_STATUS_CODES.has(error.statusCode)
        && attempt < MAX_RETRIES;
      if (!canRetry) throw error;
      await sleep(retryDelay(error, attempt));
    }
  }

  throw new Error(`Image search retries exhausted for SKU ${product.sku}.`);
}

function isUsableImageUrl(candidate) {
  if (!candidate || typeof candidate.link !== 'string'
    || !candidate.image
    || !Number.isFinite(candidate.image.width)
    || !Number.isFinite(candidate.image.height)
    || candidate.image.width < 500
    || candidate.image.height < 500) return false;
  try {
    const url = new URL(candidate.link);
    return url.protocol === 'https:' && !/\.(?:svg|gif)(?:$|\?)/i.test(url.pathname);
  } catch {
    return false;
  }
}

async function searchProductImage(product, options) {
  const result = await fetchImageResult(product, options);
  const candidate = (result.items || []).find(isUsableImageUrl);
  if (!candidate) {
    throw new Error(`No usable HTTPS image result found for SKU ${product.sku} (${product.brand} ${product.title}).`);
  }
  return candidate.link;
}

// Transform the cleaned spreadsheet data to the Mongoose Product schema used by this app.
function buildProductDocument(product, imageUrl) {
  return {
    sku: product.sku,
    brand: product.brand,
    name: product.title,
    title: product.title,
    slug: slugFromSku(product.sku),
    category: product.category,
    productType: 'physical',
    deliveryType: 'shipped',
    size: product.size,
    description: product.description,
    priceTHB: product.priceTHB,
    priceBDT: product.priceBDT,
    landedCost: product.priceTHB,
    price: product.priceBDT,
    originalPrice: product.priceBDT,
    imageUrl,
    image: imageUrl,
    images: [{ url: imageUrl }],
    inStock: true,
    stock: 0,
    seller: 'Tu Avec',
    consumable: true,
    warrantyEligible: false
  };
}

function slugFromSku(sku) {
  return sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildLegacyDemoFilter(products) {
  const catalogSkus = products.map(product => product.sku);
  const catalogSlugs = catalogSkus.map(slugFromSku);
  return {
    $and: [
      { $or: [
        { slug: { $in: LEGACY_DEMO_SLUGS } },
        { sku: { $in: LEGACY_DEMO_SKUS } }
      ] },
      { sku: { $nin: catalogSkus } },
      { slug: { $nin: catalogSlugs } }
    ]
  };
}

function parseArguments(args) {
  const options = { dryRun: false, refreshImages: false, catalogPath: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--refresh-images') {
      options.refreshImages = true;
    } else if (argument === '--file' && args[index + 1]) {
      options.catalogPath = path.resolve(args[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument "${argument}". Use --file <path>, --dry-run, or --refresh-images.`);
    }
  }
  return options;
}

// Seed the database while logging progress and preserving a clean, validated batch.
async function seedCatalog(options) {
  const catalogPath = options.catalogPath
    || process.env.PRODUCT_CATALOG_PATH
    || DEFAULT_CATALOG_PATH;
  const products = await readCatalog(catalogPath);

  if (options.dryRun) {
    console.log(`Catalog valid: ${products.length} products in ${catalogPath}. No image searches or database writes performed.`);
    return;
  }

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const engineId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !engineId) {
    throw new Error('Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID in backend/.env to search product images.');
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Set MONGO_URI in backend/.env before seeding.');

  await mongoose.connect(mongoUri);
  await Product.init();

  const existingProducts = options.refreshImages
    ? []
    : await Product.find({ sku: { $in: products.map(product => product.sku) } })
      .select('sku imageUrl')
      .lean();
  const existingImages = new Map(existingProducts.map(product => [product.sku, product.imageUrl]));
  const configuredDelay = Number.parseInt(process.env.GOOGLE_CSE_RATE_LIMIT_MS || '1200', 10);
  if (!Number.isInteger(configuredDelay) || configuredDelay < 0) {
    throw new Error('GOOGLE_CSE_RATE_LIMIT_MS must be a non-negative integer.');
  }
  const searchOptions = {
    apiKey,
    engineId,
    rateLimitMs: configuredDelay,
    lastRequestAt: 0
  };

  const enrichedProducts = [];
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const cachedImage = existingImages.get(product.sku);
    const imageUrl = cachedImage && !options.refreshImages
      ? cachedImage
      : await searchProductImage(product, searchOptions);
    enrichedProducts.push({ ...product, imageUrl });
    console.log(`[images ${index + 1}/${products.length}] ${product.sku}: ${cachedImage && !options.refreshImages ? 'reused saved image' : 'image found'}`);
  }

  for (let index = 0; index < enrichedProducts.length; index += 1) {
    const product = enrichedProducts[index];
    const document = buildProductDocument(product, product.imageUrl);
    await Product.updateOne(
      { sku: product.sku },
      { $set: document },
      { upsert: true, runValidators: true }
    );
    console.log(`[seed ${index + 1}/${enrichedProducts.length}] ${product.sku} — ${product.brand} ${product.title}`);
  }
  const legacyResult = await Product.deleteMany(buildLegacyDemoFilter(products));
  console.log(`Catalog seed complete: ${enrichedProducts.length} products upserted; ${legacyResult.deletedCount} known demo products removed.`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  try {
    await seedCatalog(options);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Catalog seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildProductDocument,
  buildLegacyDemoFilter,
  decodeCatalog,
  LEGACY_DEMO_SKUS,
  LEGACY_DEMO_SLUGS,
  parseArguments,
  parsePlainText,
  parseTableRows,
  readCatalog,
  seedCatalog
};
