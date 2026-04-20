// Import express và controller
const express = require('express');
const controller = require('../controllers/payment_controller');
const validate = require('../middlewares/validate_middleware');
const internalAuth = require('../middlewares/internalAuth_middleware');
const {
	createWalletTopupSchema,
	chargeCommissionSchema,
	createWithdrawalSchema
} = require('../validators/payment_validator');

// Khởi tạo router
const r = express.Router();

// POST route: Tạo QR code thanh toán ký cọc
r.post('/deposit/generate-qr', controller.generateDepositQR);

// GET route: Lấy thông tin giao dịch theo ID
r.get('/transaction/:id', controller.getTransaction);

// Wallet APIs
r.post('/wallet/topup/create', validate(createWalletTopupSchema), controller.createWalletTopup);
r.get('/wallet/balance', controller.getWalletBalance);
r.get('/wallet/history', controller.getWalletTransactions);
r.get('/wallet/transactions', controller.getWalletTransactions);
r.get('/wallet/recent-transactions', controller.getRecentTransactions);
r.post('/wallet/commission/charge', internalAuth, validate(chargeCommissionSchema), controller.chargeCommission);

// Withdrawal APIs (Available to restaurant owners via Gateway)
r.post('/wallet/withdraw', validate(createWithdrawalSchema), controller.createWithdrawal);
r.post('/internal/wallet/withdraw/:id/approve', internalAuth, controller.approveWithdrawal);
r.post('/internal/wallet/withdraw/:id/reject', internalAuth, controller.rejectWithdrawal);

r.post('/internal/wallet/settle-booking', internalAuth, controller.settleBookingDeposit);

// Xuất router
module.exports = r;