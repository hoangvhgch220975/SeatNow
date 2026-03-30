const express = require('express');
const router = express.Router();
const c = require('../controllers/auth_controller');

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/logout', c.logout);
router.post('/refresh-token', c.refreshToken);
router.post('/send-otp', c.sendOtp);
router.post('/verify-otp', c.verifyOtp);
// Forgot password flow (Combined: Phone + Email + OTP)
router.post('/forgot-password/request', c.requestPasswordReset);
router.post('/forgot-password/verify-and-reset', c.verifyAndResetPassword);
router.post('/google-signin', c.googleSignin);

// Internal API for Admin service
router.post('/internal/users/restaurant-owner', c.createRestaurantOwner);
router.post('/internal/users/:id/reset-password', c.resetPasswordOwnerByAdmin);

module.exports = router;
