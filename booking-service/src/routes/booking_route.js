const express = require('express');
const c = require('../controllers/booking_controller');

const jwt = require('../middlewares/jwt_middleware');
const optionalAuth = require('../middlewares/optionalAuth_middleware');
const requireRole = require('../middlewares/requireRole_middleware');
const rateLimit = require('../middlewares/rateLimit_middleware');

const r = express.Router();

// =====================================================
// Booking Routes - Single file, sections divided by role
// =====================================================

// --- Public / Guest ---------------------------------
// Create booking (guest or optional auth for customers)
r.post('/bookings', optionalAuth, rateLimit({ limit: 10, windowSec: 60, key: 'create_booking' }), c.create);

// Guest lookup: find booking by email/phone + reference
r.get('/bookings/guest/lookup', c.guestLookup);

// Availability (public)
r.get('/restaurants/:id/availability', rateLimit({ limit: 60, windowSec: 60, key: 'availability' }), c.availability);

// Guest cancellation (no customer auth required)
r.put('/bookings/:id/cancel/guest', optionalAuth, rateLimit({ limit: 10, windowSec: 60, key: 'guest_cancel' }), c.cancel);

// Kiểm tra tình trạng đặt cọc (guest/customer/owner)
r.get('/bookings/:id/payment-status', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.paymentStatus);

// --- Customer --------------------------------------
// List bookings for current logged-in customer
r.get('/bookings/my-bookings', jwt.requireAuth, requireRole('CUSTOMER'), c.myBookings);

// Booking detail: customers, owners, and admins use same endpoint
// Controller enforces ownership/role checks
r.get('/bookings/:id', jwt.requireAuth, c.getBooking);

// Customer cancel (authenticated only)
r.put('/bookings/:id/cancel', jwt.requireAuth, requireRole('CUSTOMER'), c.cancel);

// --- Owner / Admin ---------------------------------
// List bookings for a restaurant (owner/admin)
r.get('/restaurants/:id/bookings', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.restaurantBookings);

// Commission summary/settlement (owner/admin)
r.get('/restaurants/:id/commissions/summary', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.commissionSummary);
r.post('/restaurants/:id/commissions/settle', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.settleCommission);

// Owner/Admin actions on bookings
r.put('/bookings/:id/confirm', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.confirm);
r.put('/bookings/:id/arrived', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.arrived);
r.put('/bookings/:id/complete', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.complete);
r.put('/bookings/:id/no-show', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.noShow);

// QR for check-in (owner/admin)
r.get('/bookings/:id/qr', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.getQr);

module.exports = r;
