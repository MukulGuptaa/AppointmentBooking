const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true
    },
    time: {
        type: String, // Format: HH:mm
        required: true
    },
    duration: {
        type: Number, // Duration in minutes
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
        default: 'PENDING'
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    amount: {
        type: Number
    },
    // Adding expireAt field which acts as a TTL (Time To Live) index
    expireAt: {
        type: Date,
        default: undefined // By default no expiry, we set this when creating PENDING bookings
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Partial Index: Enforce uniqueness ONLY for CONFIRMED or PENDING bookings.
bookingSchema.index(
    { date: 1, time: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { status: { $in: ['CONFIRMED', 'PENDING'] } } 
    }
);

// TTL Index: Automatically delete documents after expireAt time is reached
// This is handled by MongoDB background worker (~60s precision)
bookingSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Booking', bookingSchema);
