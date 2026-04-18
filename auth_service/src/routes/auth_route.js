const express = require('express');
const router = express.Router();
const c = require('../controllers/auth_controller');
const { requireAuth } = require('../middlewares/jwt_middleware');

router.get('/exists', c.checkExists);
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
router.put('/change-password', requireAuth, c.changePassword);

// Internal API for Admin service
router.post('/internal/users/restaurant-owner', c.createRestaurantOwner);
router.post('/internal/users/:id/reset-password', c.resetPasswordOwnerByAdmin);
router.put('/internal/users/:id', c.updateUserInternal);
router.delete('/internal/users/:id', c.deleteUserInternal);

// Partner Request APIs
router.post('/partner-request', c.submitPartnerRequest);
router.get('/internal/partner-requests', c.getPartnerRequests);
router.get('/internal/partner-requests/:id', c.getPartnerRequestById);
router.delete('/internal/partner-requests/:id', c.deletePartnerRequest);

module.exports = router;
