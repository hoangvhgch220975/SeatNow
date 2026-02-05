const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment.controller');

router.post('/', controller.createPayment);
router.post('/webhook', controller.paymentWebhook);

module.exports = router;
