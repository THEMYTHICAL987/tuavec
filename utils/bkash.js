const axios = require('axios');

const BKASH_BASE_URL = process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh';
const APP_KEY = process.env.BKASH_APP_KEY || '';
const APP_SECRET = process.env.BKASH_APP_SECRET || '';
const USERNAME = process.env.BKASH_USERNAME || '';
const PASSWORD = process.env.BKASH_PASSWORD || '';

async function getAccessToken() {
    if (!APP_KEY || !APP_SECRET) {
        throw new Error('bKash app key/secret not configured');
    }

    const url = `${BKASH_BASE_URL}/tokenized/checkout/token/grant`;

    try {
        const resp = await axios.post(url, {
            app_key: APP_KEY,
            app_secret: APP_SECRET
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (resp.data && resp.data.id_token) {
            return resp.data.id_token;
        }

        throw new Error('Invalid bKash token response');
    } catch (err) {
        throw new Error('Failed to get bKash token: ' + (err.response && err.response.data ? JSON.stringify(err.response.data) : err.message));
    }
}

async function createPayment({ amount, orderId, orderNumber, callbackUrl }) {
    const token = await getAccessToken();

    const url = `${BKASH_BASE_URL}/tokenized/checkout/create`;

    const body = {
        amount: amount.toString(),
        currency: 'BDT',
        merchantInvoiceNumber: orderNumber || orderId,
        intent: 'sale',
        merchantCallbackURL: callbackUrl || `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/bkash/callback`
    };

    try {
        const resp = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                'authorization': token,
                'x-app-key': APP_KEY
            }
        });

        if (resp.data && resp.data.paymentID && resp.data.bkashURL) {
            return {
                paymentId: resp.data.paymentID,
                paymentUrl: resp.data.bkashURL,
                raw: resp.data
            };
        }

        // Some environments return a different shape; return full response for debugging
        return { raw: resp.data };
    } catch (err) {
        throw new Error('Failed to create bKash payment: ' + (err.response && err.response.data ? JSON.stringify(err.response.data) : err.message));
    }
}

async function verifyPayment(paymentID) {
    const token = await getAccessToken();
    const url = `${BKASH_BASE_URL}/tokenized/checkout/payment/execute`; // verify/execute endpoint may vary by integration

    try {
        const resp = await axios.post(url, { paymentID }, {
            headers: {
                'Content-Type': 'application/json',
                'authorization': token,
                'x-app-key': APP_KEY
            }
        });

        return resp.data;
    } catch (err) {
        throw new Error('Failed to verify bKash payment: ' + (err.response && err.response.data ? JSON.stringify(err.response.data) : err.message));
    }
}

module.exports = {
    getAccessToken,
    createPayment,
    verifyPayment
};
