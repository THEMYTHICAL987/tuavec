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
npm start
```

The app will be available at http://localhost:5000.

## Credentials and integrations

Copy `backend/.env.example` to `backend/.env`. Keep the real file private; it is ignored by Git.

- `MONGODB_URI`: MongoDB Atlas connection string. Create the database user and allow the backend host in Atlas Network Access.
- `JWT_SECRET`: long random string used to sign customer login tokens.
- `ADMIN_TOKEN`: separate long random token for admin-only API requests.
- `FRONTEND_URL`: exact browser origin allowed by CORS, such as `http://localhost:5000`.
- WhatsApp: create a Meta WhatsApp Cloud API app, then place the phone number ID and access token in `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`. Keep the token server-side.
- SSLCommerz: obtain Store ID and Store Password from the SSLCommerz merchant panel. Use sandbox credentials while `SSLCOMMERZ_IS_LIVE=false`; switch to live credentials and HTTPS callback URLs for production.
- bKash Merchant: obtain Tokenized Checkout app key, app secret, username, and password from the bKash merchant portal. Use sandbox base URL and callback URL for local testing.

The current backend accepts `cod`, `bkash`, `nagad`, and `rocket` as order values, but SSLCommerz and bKash payment API flows still need their route/service implementations before those credentials can process real payments. Add those integrations under `backend/routes` and call them from the checkout handler; never expose payment secrets in `frontend/index.html`.

Before using any credentials, rotate the MongoDB password and JWT secret that may have been shared in older environment templates.
