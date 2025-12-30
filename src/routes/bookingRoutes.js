const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const PaymentService = require('../services/payment/PaymentService');
const crypto = require('crypto');

// @desc    Get slots status for a specific date
// @route   GET /api/bookings/slots?date=YYYY-MM-DD&userId=ID
// @access  Public
router.get('/slots', async (req, res) => {
    const { date, userId } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required' });
    }

    try {
        const startHour = 9;
        const endHour = 17;
        const timeSlots = [];

        for (let i = startHour; i < endHour; i++) {
            const hour = i.toString().padStart(2, '0');
            timeSlots.push(`${hour}:00`);
        }

        const bookings = await Booking.find({
            date,
            status: { $in: ['CONFIRMED', 'PENDING'] } // Check PENDING too to avoid double booking during payment
        });

        const slotsWithStatus = timeSlots.map(time => {
            const booking = bookings.find(b => b.time === time);
            let status = 'AVAILABLE';
            let bookingId = null;

            if (booking) {
                if (userId && booking.user.toString() === userId) {
                    status = 'BOOKED_BY_ME';
                    if (booking.status === 'PENDING') status = 'PAYMENT_PENDING';
                    bookingId = booking._id;
                } else {
                    status = 'BOOKED_BY_OTHERS';
                }
            }

            return {
                time,
                status,
                bookingId
            };
        });

        res.json(slotsWithStatus);
    } catch (error) {
        console.error('[Booking] Error fetching slots:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Book a time slot and initiate payment
// @route   POST /api/bookings
// @access  Public
router.post('/', async (req, res) => {
    const { date, time, userId, duration, amount = 1 } = req.body; // Default amount 1 if not sent

    console.log(`[Booking] Create Request - Date: ${date}, Time: ${time}, User: ${userId}`);

    if (!date || !time || !userId || !duration) {
        return res.status(400).json({ message: 'Date, time, userId, and duration are required' });
    }

    try {
        // Check if slot is already booked (CONFIRMED or PENDING)
        const existingBooking = await Booking.findOne({
            date,
            time,
            status: { $in: ['CONFIRMED', 'PENDING'] }
        });

        if (existingBooking) {
            console.warn(`[Booking] Slot already booked: ${date} ${time}`);
            return res.status(400).json({ message: 'Slot already booked or reserved' });
        }

        // Generate a unique Order ID
        const orderId = `ORDER_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        // Initiate Payment First to get expireAt
        console.log(`[Booking] Initiating Payment for OrderID: ${orderId}`);
        const paymentResponse = await PaymentService.initiatePayment({
            amount,
            orderId,
            userId,
            mobileNumber: "9999999999" // In real app, fetch from User model
        });

        const booking = await Booking.create({
            user: userId,
            date,
            time,
            duration,
            amount,
            status: 'PENDING',
            transactionId: orderId,
            expireAt: paymentResponse.expireAt
        });

        console.log(`[Booking] Created PENDING booking: ${booking._id}`);

        res.status(201).json({
            booking,
            paymentUrl: paymentResponse.redirectUrl
        });

    } catch (error) {
        console.error('[Booking] Creation Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Cancel a booking
// @route   DELETE /api/bookings/:id
// @access  Public
router.delete('/:id', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'userId is required (in body) to cancel' });
    }

    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.user.toString() !== userId) {
            return res.status(401).json({ message: 'Not authorized to cancel this booking' });
        }

        await booking.deleteOne();
        console.log(`[Booking] Booking cancelled/deleted: ${req.params.id}`);

        res.json({ message: 'Booking removed' });
    } catch (error) {
        console.error('[Booking] Cancellation Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
