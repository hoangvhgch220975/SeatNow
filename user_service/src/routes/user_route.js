const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth_middleware');
const c = require('../controllers/user_controller');

// Base: /api/v1/users
// Route for Customer and Restaurant Owner
router.get('/me', requireAuth, c.me); 
router.put('/me', requireAuth, c.updateMe);
router.get('/me/wallet', requireAuth, c.myWallet);

// Route for only Customer
router.get('/me/bookings', requireAuth, c.myBookings);
router.get('/me/loyalty-points', requireAuth, c.myLoyaltyPoints);

module.exports = router;
