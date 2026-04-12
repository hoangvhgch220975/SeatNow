// Import service xử lý đặt cọc và model giao dịch
const depositService = require('../services/deposit_service');
const walletService = require('../services/wallet_service');
const withdrawalService = require('../services/withdrawal_service');
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

// Tao top-up payment cho vi nha hang.
async function createWalletTopup(req, res, next) {
  try {
    const { restaurantId, provider, amount } = req.body;

    const result = await walletService.createWalletTopup({
      restaurantId,
      provider,
      amount,
      req
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Lay so du vi theo restaurant.
async function getWalletBalance(req, res, next) {
  try {
    const { restaurantId } = req.query;
    const data = await walletService.getWalletBalance({ restaurantId });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Lay lich su giao dich vi theo restaurant.
async function getWalletTransactions(req, res, next) {
  try {
    const { restaurantId, type } = req.query;
    const data = await walletService.getWalletHistory({ restaurantId, type });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Admin charge commission tu vi restaurant sang vi admin.
async function chargeCommission(req, res, next) {
  try {
    const { restaurantId, adminUserId, amount, description, idempotencyKey } = req.body;

    const result = await walletService.chargeCommission({
      restaurantId,
      adminUserId,
      amount,
      description,
      idempotencyKey
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Tạo yêu cầu rút tiền
async function createWithdrawal(req, res, next) {
  try {
    const { idOrSlug, amount, description, withdrawMethod, bankInfo, qrCodeUrl } = req.body;
    const result = await withdrawalService.createWithdrawal({
      idOrSlug,
      amount,
      description,
      withdrawMethod,
      bankInfo,
      qrCodeUrl
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Admin duyệt rút tiền
async function approveWithdrawal(req, res, next) {
  try {
    const { providerTxnId, metadataJson } = req.body;
    const result = await withdrawalService.approveWithdrawal({
      transactionId: req.params.id,
      providerTxnId,
      metadataJson
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Admin từ chối rút tiền
async function rejectWithdrawal(req, res, next) {
  try {
    const { reason } = req.body;
    const result = await withdrawalService.rejectWithdrawal({
      transactionId: req.params.id,
      reason
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Giải ngân tiền cọc cho nhà hàng (Internal API)
async function settleBookingDeposit(req, res, next) {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }

    const result = await paymentModel.settleDepositToWallet(bookingId);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Lay 5 giao dich gan nhat cho owner dashboard
async function getRecentTransactions(req, res, next) {
  try {
    const { restaurantId, limit } = req.query;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId is required' });
    
    const data = await walletService.getRecentTransactions({ 
      restaurantId, 
      limit: parseInt(limit || '5', 10) 
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Export các handler để route sử dụng
module.exports = {
  generateDepositQR,
  getTransaction,
  createWalletTopup,
  getWalletBalance,
  getWalletTransactions,
  getRecentTransactions,
  chargeCommission,
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  settleBookingDeposit
};