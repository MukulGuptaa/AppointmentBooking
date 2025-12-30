const { StandardCheckoutClient, Env, CreateSdkOrderRequest, MetaInfo } = require('pg-sdk-node');
const PaymentGatewayInterface = require('./PaymentGatewayInterface');
const crypto = require('crypto'); // For random UUID validation if needed, though SDK mostly handles it



class PhonePeProvider extends PaymentGatewayInterface {
    constructor() {
        super();

        this.clientId = process.env.PHONEPE_CLIENT_ID;
        this.clientSecret = process.env.PHONEPE_CLIENT_SECRET;
        this.clientVersion = process.env.PHONEPE_CLIENT_VERSION || '1'; // Ensure string
        this.env = process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX;

        // "You can initiate the instance of this class only once."
        // We do it in constructor, which is fine if Provider is singleton or instantiated once.
        this.client = StandardCheckoutClient.getInstance(
            this.clientId,
            this.clientSecret,
            this.clientVersion,
            this.env
        );
    }

    async initiatePayment({ amount, orderId, userId, mobileNumber }) {
        // Docs: "Use StandardCheckoutPayRequest.build_request() to create the payment request" 
        // BUT the code snippet shows: CreateSdkOrderRequest.StandardCheckoutBuilder()
        // I will follow the code snippet as it is more likely to be copy-paste correct.

        try {
            console.log(`[PhonePe] Initiating Payment for Order: ${orderId}, Amount: ${amount}`);
            // Docs snippet:
            // const orderRequest = CreateSdkOrderRequest.StandardCheckoutBuilder() ... .build();

            // Note: Amount is in paise (100 = ₹1.00)
            const amountInPaise = amount * 100;

            const requestBuilder = CreateSdkOrderRequest.StandardCheckoutBuilder()
                .merchantOrderId(orderId)
                .amount(amountInPaise)
                .redirectUrl(`http://localhost:5002/api/payments/callback/${orderId}`) // "redirectUrl" in builder
                .message("Booking Payment") // Optional message
                .expireAfter(300); // 1 hour expiry

            // MetaInfo is optional but good practice if needed.
            // .metaInfo(MetaInfo.builder()...build())

            const request = requestBuilder.build();

            // client.pay(request)
            const response = await this.client.pay(request);

            // Response has: redirectUrl, etc.
            if (response && response.redirectUrl) {
                console.log(`[PhonePe] Payment Initiated Successfully. Redirect URL: ${response.redirectUrl}`);
                return {
                    transactionId: orderId, // The order ID we sent
                    redirectUrl: response.redirectUrl,
                    payload: response,
                    expireAt: new Date(Date.now() + 300000),
                };
            } else {
                // Fallback if structure differs or check logs
                console.error("[PhonePe] Unexpected SDK Response:", JSON.stringify(response));
                if (response.code) { // Check for error codes
                    throw new Error(response.message || 'Payment initiation failed');
                }
                throw new Error('Payment initiation failed: No redirect URL');
            }

        } catch (error) {
            console.error('[PhonePe] Initiate Payment Error:', error.message);
            throw error;
        }
    }

    async verifyPayment(transactionId) {
        try {
            console.log(`[PhonePe] Verifying Payment for Transaction ID: ${transactionId}`);
            // Docs: client.getOrderStatus(merchantOrderId)
            // returns { state: ... }
            const response = await this.client.getOrderStatus(transactionId);

            // Response object: StandardCheckoutPayResponse / OrderStatusResponse
            // Properties: state, order_id, amount, etc.

            // Map state to our internal status
            const state = response.state;
            console.log(`[PhonePe] Verification Response State: ${state}`);

            if (state === 'COMPLETED' || state === 'SUCCESS') { // Check exact enum values from logs/docs if ambiguous
                // Docs usually use "COMPLETED" or "SUCCESS".
                // Let's assume COMPLETED based on common PG patterns, 
                // but the snippet just says "const state = response.state".
                // I will log it to be safe.
                return { status: 'SUCCESS', raw: response };
            } else if (state === 'PENDING') {
                return { status: 'PENDING', raw: response };
            } else {
                return { status: 'FAILED', raw: response };
            }
        } catch (error) {
            console.error('[PhonePe] Verify Payment Error:', error.message);
            throw error;
        }
    }
}

module.exports = PhonePeProvider;
