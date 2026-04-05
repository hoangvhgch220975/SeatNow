// webhook.controller.js
// Controller nhận webhook/return từ cổng thanh toán và gọi webhook_service để xử lý.

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

/**
 * Xu ly return URL tu MOMO va redirect ve frontend.
 * Giai phap "Port Hopper": Thay vi hien thi trang thanh cong tai BE (Port 3005), 
 * chung ta Redirect ve cung Port voi Frontend (Port 5173) de co the dong bo 100% qua BroadcastChannel.
 */
async function handleMomoReturn(req, res, next) {
  try {
    console.log(`[DEBUG_CONTROLLER] Processing MOMO Return`);
    const result = await webhookService.handleProviderReturn({
      provider: 'MOMO',
      query: req.query,
      body: req.body
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Luon redirect ve ve Frontend de dam bao cung Port voi App chinh
    // Neu thanh cong: kem theo param de FE biet va "het" cho Tab chinh
    const status = result.success ? 'success' : 'failed';
    const redirectTarget = `${frontendUrl}/?payment_status=${status}&bookingId=${result.bookingId || ''}`;
    
    console.log(`[DEBUG_CONTROLLER] Redirecting MOMO result to Frontend: ${redirectTarget}`);
    return res.redirect(redirectTarget);
  } catch (err) {
    console.error(`[DEBUG_CONTROLLER] MOMO Return ERROR: ${err.message}`);
    next(err);
  }
}

// Xu ly return URL tu VNPAY va redirect ve frontend
async function handleVNPayReturn(req, res, next) {
  try {
    console.log(`[DEBUG_CONTROLLER] Processing VNPAY Return`);
    const result = await webhookService.handleProviderReturn({
      provider: 'VNPAY',
      query: req.query,
      body: req.body
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const status = result.success ? 'success' : 'failed';
    const redirectTarget = `${frontendUrl}/?payment_status=${status}&bookingId=${result.bookingId || ''}`;

    console.log(`[DEBUG_CONTROLLER] Redirecting VNPAY result to Frontend: ${redirectTarget}`);
    return res.redirect(redirectTarget);
  } catch (err) {
    console.error(`[DEBUG_CONTROLLER] VNPAY Return ERROR: ${err.message}`);
    next(err);
  }
}

module.exports = {
  handleMomoWebhook,
  handleVNPayWebhook,
  handleMomoReturn,
  handleVNPayReturn
};