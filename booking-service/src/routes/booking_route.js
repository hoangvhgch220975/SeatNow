const express = require('express');
const c = require('../controllers/booking_controller');

const jwt = require('../middlewares/jwt_middleware');
const optionalAuth = require('../middlewares/optionalAuth_middleware');
const requireRole = require('../middlewares/requireRole_middleware');
const rateLimit = require('../middlewares/rateLimit_middleware');

const r = express.Router();

// Public/Guest
r.post('/bookings', optionalAuth, rateLimit({ limit: 10, windowSec: 60, key: 'create_booking' }), c.create);
r.get('/bookings/guest/lookup', c.guestLookup); // Lookup for guests to find their booking using email and booking reference

// Availability (public)
r.get('/restaurants/:id/availability', rateLimit({ limit: 60, windowSec: 60, key: 'availability' }), c.availability);

// Customer
r.get('/bookings/my-bookings', jwt.requireAuth, requireRole('CUSTOMER'), c.myBookings);
// Booking detail (customer / owner / admin) - controller enforces ownership
r.get('/bookings/:id', jwt.requireAuth, c.getBooking);

// Owner/Admin actions
r.get('/restaurants/:id/bookings', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.restaurantBookings);

r.put('/bookings/:id/confirm', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.confirm);
r.put('/bookings/:id/arrived', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.arrived);
r.put('/bookings/:id/complete', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.complete);
r.put('/bookings/:id/no-show', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.noShow);
// QR for check-in
r.get('/bookings/:id/qr', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.getQr);

// Cancel: split customer vs guest cancellation
// - Customer cancel: authenticated customers only
r.put('/bookings/:id/cancel', jwt.requireAuth, requireRole('CUSTOMER'), c.cancel);

// Guest cancellation (no customer auth required)
r.put('/bookings/:id/cancel/guest', optionalAuth, rateLimit({ limit: 10, windowSec: 60, key: 'guest_cancel' }), c.cancel);

module.exports = r;
