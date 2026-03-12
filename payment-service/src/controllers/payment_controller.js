// Import service xử lý đặt cọc và model giao dịch
const depositService = require('../services/deposit_service');
const paymentModel = require('../models/payment_sql');

// Tạo QR/link thanh toán đặt cọc cho booking
async function generateDepositQR(req, res, next) {
  try {
    // Lấy bookingId và cổng thanh toán từ request
    const { bookingId, provider } = req.body;

    // Gọi service tạo giao dịch đặt cọc
    const result = await depositService.generateDepositPayment({
      bookingId,
      provider,
      req
    });

    // Trả về dữ liệu thanh toán cho client
    return res.json({ success: true, data: result });
  } catch (err) {
    // Chuyển lỗi cho middleware xử lý lỗi chung
    next(err);
  }
}

// Lấy thông tin giao dịch theo transaction id
async function getTransaction(req, res, next) {
  try {
    const tx = await paymentModel.findTransactionById(req.params.id);
    // Không tìm thấy giao dịch thì trả 404
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    return res.json({ success: true, data: tx });
  } catch (err) {
    // Chuyển lỗi cho middleware xử lý lỗi chung
    next(err);
  }
}

// Export các handler để route sử dụng
module.exports = {
  generateDepositQR,
  getTransaction
};