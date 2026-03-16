const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin_controller');
const jwt = require('../middlewares/jwt_middleware');
const requireRole = require('../middlewares/requireRole_middleware');

// Toan bo route admin bat buoc dang nhap va co role ADMIN.
router.use(jwt.requireAuth, requireRole('ADMIN'));

// Dashboard / thong ke
router.get('/dashboard/stats', controller.getStats);

// Quan ly nha hang
router.post('/restaurants', controller.createRestaurant);
router.put('/restaurants/:id', controller.updateRestaurant);
router.get('/restaurants/pending', controller.getPendingRestaurants);
router.put('/restaurants/:id/approve', controller.approveRestaurant);
router.put('/restaurants/:id/suspend', controller.suspendRestaurant);

// Quan ly nguoi dung, booking, giao dich
router.get('/users', controller.getUsers);
router.get('/bookings', controller.getBookings);
router.get('/transactions', controller.getTransactions);

// Quy trinh doi soat commission theo quy
router.post('/commissions/settle-quarter', controller.settleQuarterCommission);

// Quy trinh duyet / tu choi rut tien
router.post('/withdrawals/:id/approve', controller.approveWithdrawal);
router.post('/withdrawals/:id/reject', controller.rejectWithdrawal);

module.exports = router;
