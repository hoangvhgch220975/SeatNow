// webhook.controller.js
// Controller nhan webhook/return tu cong thanh toan va goi webhook_service de xu ly.

const webhookService = require('../services/webhook_service');

// Xu ly webhook MOMO
async function handleMomoWebhook(req, res, next) {
  try {
    const result = await webhookService.processProviderResult({
      provider: 'MOMO',
      payload: req.body,
      verifySignature: true
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Xu ly webhook VNPAY
async function handleVNPayWebhook(req, res, next) {
  try {
    // VNPAY co the gui du lieu qua query hoac body
    const payload = req.query && Object.keys(req.query).length ? req.query : req.body;

    const result = await webhookService.processProviderResult({
      provider: 'VNPAY',
      payload,
      verifySignature: true
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Xu ly return URL tu MOMO va redirect ve frontend
async function handleMomoReturn(req, res, next) {
  try {
    const redirectUrl = await webhookService.handleProviderReturn({
      provider: 'MOMO',
      query: req.query,
      body: req.body
    });

    return res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
}

// Xu ly return URL tu VNPAY va redirect ve frontend
async function handleVNPayReturn(req, res, next) {
  try {
    const redirectUrl = await webhookService.handleProviderReturn({
      provider: 'VNPAY',
      query: req.query,
      body: req.body
    });

    return res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleMomoWebhook,
  handleVNPayWebhook,
  handleMomoReturn,
  handleVNPayReturn
};