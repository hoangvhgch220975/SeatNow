const express = require('express');
const c = require('../controllers/booking_controller');

const jwt = require('../middlewares/jwt_middleware');
const optionalAuth = require('../middlewares/optionalAuth_middleware');
const requireRole = require('../middlewares/requireRole_middleware');

const r = express.Router();

// Public/Guest
r.post('/bookings', optionalAuth, c.create);
r.get('/bookings/guest/lookup', c.guestLookup);

// Availability (public)
r.get('/restaurants/:id/availability', c.availability);

// Customer
r.get('/bookings/my-bookings', jwt.requireAuth, requireRole('CUSTOMER'), c.myBookings);

// Owner/Admin actions
r.get('/restaurants/:id/bookings', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.restaurantBookings);

r.put('/bookings/:id/confirm', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.confirm);
r.put('/bookings/:id/arrived', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.arrived);
r.put('/bookings/:id/complete', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.complete);
r.put('/bookings/:id/no-show', jwt.requireAuth, requireRole('RESTAURANT_OWNER','ADMIN'), c.noShow);

// Cancel: split customer vs guest cancellation
// - Customer cancel: authenticated customers only
r.put('/bookings/:id/cancel', jwt.requireAuth, requireRole('CUSTOMER'), c.cancel);

// Guest cancellation (no customer auth required)
r.put('/bookings/:id/cancel/guest', optionalAuth, c.cancel);

module.exports = r;
