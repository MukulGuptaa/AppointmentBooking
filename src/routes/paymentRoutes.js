const express = require('express');
const router = express.Router();
const PaymentService = require('../services/payment/PaymentService');
const Booking = require('../models/Booking');

// @desc    Handle Payment Callback from PhonePe
// @route   POST /api/payments/callback
router.get('/callback/:bookingId', async (req, res) => {
    console.log(`[Payment] Callback received for ID: ${req.params.bookingId}`);
    
    // In callback, the bookingId passed in URL is actually the transactionId (orderId)
    const status = await verifyPaymentByTransactionId(req.params.bookingId);
    
    if (status.status === 'ERROR') {
        console.error(`[Payment] Callback Error for ${req.params.bookingId}: ${status.message}`);
        res.send(getErrorHtml("Payment Status Unknown", "We could not verify your payment status."));
    } else if (status.status === 'CONFIRMED') {
        console.log(`[Payment] Callback Success for ${req.params.bookingId}`);
        res.send(getSuccessHtml());
    } else {
        console.warn(`[Payment] Callback Failed for ${req.params.bookingId} - Status: ${status.status}`);
        res.send(getFailedHtml());
    }
});

// @desc    Manually check payment status
// @route   GET /api/payments/check-status/:bookingId
router.get('/check-status/:bookingId', async (req, res) => {
    const bookingId = req.params.bookingId;
    console.log(`[Payment] Check Status Request for Booking ID: ${bookingId}`);
    
    const status = await verifyPaymentById(bookingId);
    
    if (status.status === 'ERROR') {
        console.error(`[Payment] Check Status Error: ${status.message}`);
        res.status(500).json({ message: status.message });
    } else {
        console.log(`[Payment] Check Status Result: ${status.status}`);
        res.json({ status: status.status, paymentStatus: status.paymentStatus });
    }
});

// Helper for check-status (uses Database _id)
async function verifyPaymentById(bookingId){
    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return { status: 'ERROR', message: 'Booking not found' };

        if (!booking.transactionId) return { status: 'ERROR', message: 'No transaction ID associated' };

        const result = await PaymentService.verifyPayment(booking.transactionId);

        if (result.status === 'SUCCESS') {
            booking.status = 'CONFIRMED';
            booking.expireAt = undefined; 
            await booking.save();
        } else if (result.status === 'FAILED') {
            booking.status = 'CANCELLED'; 
            booking.expireAt = undefined; 
            await booking.save();
        }

        return { status: booking.status, paymentStatus: result.status };
    } catch (error) {
        return { status: 'ERROR', message: error.message };
    }
}

// Helper for callback (uses transactionId / orderId)
async function verifyPaymentByTransactionId(transactionId){
    try {
        const booking = await Booking.findOne({ transactionId: transactionId });
        
        if (!booking) {
            return { status: 'ERROR', message: `Booking not found for Transaction ID: ${transactionId}` };
        }

        const result = await PaymentService.verifyPayment(booking.transactionId);

        if (result.status === 'SUCCESS') {
            booking.status = 'CONFIRMED';
            booking.expireAt = undefined; 
            await booking.save();
        } else if (result.status === 'FAILED') {
            booking.status = 'CANCELLED'; 
            booking.expireAt = undefined; 
            await booking.save();
        }

        return { status: booking.status, paymentStatus: result.status };
    } catch (error) {
        return { status: 'ERROR', message: error.message };
    }
}

// HTML Templates
function getSuccessHtml() {
    return `
        <html>
            <head>
                <title>Payment Successful</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    .success { color: #28a745; font-size: 24px; font-weight: bold; }
                    p { color: #555; }
                </style>
            </head>
            <body>
                <div class="success">✅ Payment Successful</div>
                <p>Your booking has been confirmed.</p>
                <p>You can verify this in the app.</p>
                <button onclick="window.close()">Close Window</button>
            </body>
        </html>`;
}

function getFailedHtml() {
    return `
        <html>
            <head>
                <title>Payment Failed</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    .failed { color: #dc3545; font-size: 24px; font-weight: bold; }
                    p { color: #555; }
                </style>
            </head>
            <body>
                <div class="failed">❌ Payment Failed/Cancelled</div>
                <p>Your payment could not be completed.</p>
                <button onclick="window.close()">Close Window</button>
            </body>
        </html>`;
}

function getErrorHtml(title, message) {
    return `
        <html>
            <head>
                <title>${title}</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    .error { color: #dc3545; font-size: 24px; font-weight: bold; }
                    p { color: #555; }
                </style>
            </head>
            <body>
                <div class="error">❌ ${title}</div>
                <p>${message}</p>
                <p>Please go to the application and check the booking status.</p>
                <button onclick="window.close()">Close Window</button>
            </body>
        </html>`;
}

module.exports = router;
