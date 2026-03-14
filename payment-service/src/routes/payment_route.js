// Import express và controller
const express = require('express');
const controller = require('../controllers/payment_controller');
const validate = require('../middlewares/validate_middleware');
const {
	createWalletTopupSchema,
	chargeCommissionSchema
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
r.get('/wallet/transactions', controller.getWalletTransactions);
r.post('/wallet/commission/charge', validate(chargeCommissionSchema), controller.chargeCommission);

// Xuất router
module.exports = r;