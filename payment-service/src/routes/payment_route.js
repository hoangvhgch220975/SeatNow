// Import express và controller
const express = require('express');
const controller = require('../controllers/payment_controller');

// Khởi tạo router
const r = express.Router();

// POST route: Tạo QR code thanh toán ký cọc
r.post('/deposit/generate-qr', controller.generateDepositQR);

// GET route: Lấy thông tin giao dịch theo ID
r.get('/transaction/:id', controller.getTransaction);

// Xuất router
module.exports = r;