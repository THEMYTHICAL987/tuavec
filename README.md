# Tu Avec Marketplace

A lean, deploy-ready single-site e-commerce storefront with:
- one frontend page for home, shop, cart, checkout, and vendor onboarding
- a lightweight backend API for products, vendors, commissions, and orders
- marketplace logic that shifts to merchant-led growth as more vendors join

## Deploy now
1. Install dependencies in the backend folder.
2. Start the server.
3. Open the frontend page or visit the backend URL.

### Local run
```bash
cd backend
npm install
npm run seed:products -- --dry-run
npm run seed:products -- --skip-images
npm start
```

The app will be available at http://localhost:5000.

The product seeder imports `beautyandskincareproducts.txt` from the repository root and upserts products by SKU. By default it looks up images with Google Custom Search, then deletes only the known legacy demo product records. Configure `MONGO_URI` (or `MONGODB_URI`), `GOOGLE_CSE_API_KEY`, and `GOOGLE_CSE_ID` in `backend/.env` for image lookups. Use `--skip-images` to import without image URLs when image search is not configured. Imported products have stock 0 and are marked unavailable because the source has no inventory counts; update verified inventory before taking orders. The storefront also serves `frontend/catalog-preview.json` as a display-only fallback.

## Store operations dashboard

Open `/admin.html` on the deployed storefront. Configure a strong `ADMIN_TOKEN` in the backend host environment (Render) before using the dashboard; the backend intentionally refuses admin access if no token is configured. The token is entered for the current browser tab and is not saved to local storage. Add the storefront origin to `FRONTEND_URL` if it is not already included in the backend's allowed CORS origins.

The dashboard provides:
- Product search and editing for stock, base retail price, featured placement, and percentage discounts (1–80%). Discounted prices are used at checkout; campaigns can be removed to restore the base price.
- CSV stock updates using `sku,stock` columns. Unknown SKUs are reported and not inserted. Stock changes update purchase availability.
- Order review and the allowed pending → confirmed → shipped → delivered workflow. Pending orders can be cancelled through the existing inventory-restoring cancellation handler; completion uses the existing commission/rewards handler.
- Product image suggestions from Google Custom Search. Configure `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID` on the backend host. Search results are suggestions and must be reviewed before saving. A verified HTTPS image URL can also be entered manually.

Do not set stock above verified, physically available quantities. Image search requires Google Custom Search API access and quota; without it, use a verified image URL from a source you are permitted to use.

## Credentials and integrations

Configure the existing `backend/.env` with local credentials. Never commit `.env` files or share their values.

- `MONGODB_URI`: MongoDB Atlas connection string. Create the database user and allow the backend host in Atlas Network Access.
- `JWT_SECRET`: long random string used to sign customer login tokens.
- `ADMIN_TOKEN`: separate long random token for admin-only API requests.
- `FRONTEND_URL`: exact browser origin allowed by CORS, such as `http://localhost:5000`.
- WhatsApp: create a Meta WhatsApp Cloud API app, then place the phone number ID and access token in `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`. Keep the token server-side.
- SSLCommerz: obtain Store ID and Store Password from the SSLCommerz merchant panel. Use sandbox credentials while `SSLCOMMERZ_IS_LIVE=false`; switch to live credentials and HTTPS callback URLs for production.
- bKash Merchant: obtain Tokenized Checkout app key, app secret, username, and password from the bKash merchant portal. Use sandbox base URL and callback URL for local testing.

The current backend accepts `cod`, `bkash`, `nagad`, and `rocket` as order values, but SSLCommerz and bKash payment API flows still need their route/service implementations before those credentials can process real payments. Add those integrations under `backend/routes` and call them from the checkout handler; never expose payment secrets in `frontend/index.html`.

Before using any credentials, rotate the MongoDB password and JWT secret that may have been shared in older environment templates.
