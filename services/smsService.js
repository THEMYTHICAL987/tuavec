const axios = require('axios');

const sendSMS = async (phone, message) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`📱 [SMS SERVICE] ${phone}: ${message}`);
        return { success: true };
    }

    try {
        const response = await axios.post(process.env.SMS_GATEWAY_URL, {
            to: phone,
            message
        }, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SMS_GATEWAY_API_KEY}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('SMS service error:', error?.response?.data || error.message || error);
        return { success: false, error: error?.response?.data?.error || error.message || 'SMS service request failed' };
    }
};

const notifyLogisticsAlertSMS = async (phone, message) => {
    return await sendSMS(phone, message);
};

const buildLogisticsStatusMessage = (orderNumber, status, courierName, notes) => {
    const prefix = `Order #${orderNumber} update:`;
    const courierText = courierName ? ` via ${courierName}` : '';
    const noteText = notes ? ` Note: ${notes}` : '';
    return `${prefix} status is now '${status}'${courierText}.${noteText} Please check the tracking page for details.`;
};

module.exports = {
    sendSMS,
    notifyLogisticsAlertSMS,
    buildLogisticsStatusMessage
};
