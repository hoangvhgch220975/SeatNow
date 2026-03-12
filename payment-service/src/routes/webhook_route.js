// webhook.route.js
// Khai bao endpoint webhook/return cho cac cong thanh toan.
// Cac endpoint nay de public, bao mat bang verify signature trong service/controller.

const express = require('express');
const c = require('../controllers/webhook_controller');

const r = express.Router();

r.post('/webhook/momo', c.handleMomoWebhook);
r.post('/webhook/vnpay', c.handleVNPayWebhook);

r.get('/return/momo', c.handleMomoReturn);
r.get('/return/vnpay', c.handleVNPayReturn);

module.exports = r;