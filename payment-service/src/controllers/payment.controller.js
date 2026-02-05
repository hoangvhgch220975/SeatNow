/**
 * payment.controller.js - HTTP handlers (placeholder)
 */
const paymentService = require('../services/payment.service');

async function createPayment(req, res) {
  const payload = req.body;
  const result = await paymentService.createPayment(payload);
  res.json(result);
}

async function paymentWebhook(req, res) {
  // Verify & process webhook
  res.status(200).send('OK');
}

module.exports = { createPayment, paymentWebhook };
