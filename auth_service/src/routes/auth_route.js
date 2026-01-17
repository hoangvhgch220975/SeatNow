const express = require('express');
const router = express.Router();
const c = require('../controllers/auth_controller');

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/logout', c.logout);
router.post('/refresh-token', c.refreshToken);
router.post('/send-otp', c.sendOtp);
router.post('/verify-otp', c.verifyOtp);
// forgot-password có thể alias = send-otp (tùy bạn)
router.post('/forgot-password', c.sendOtp);
router.post('/reset-password', c.resetPassword);
router.post('/google-signin', c.googleSignin);

module.exports = router;
