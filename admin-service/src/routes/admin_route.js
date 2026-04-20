const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin_controller');
const jwt = require('../middlewares/jwt_middleware');
const requireRole = require('../middlewares/requireRole_middleware');

// Toan bo route admin bat buoc dang nhap va co role ADMIN.
router.use(jwt.requireAuth, requireRole('ADMIN'));

// Dashboard / thong ke
router.get('/dashboard/stats', controller.getStats);
router.get('/dashboard/revenue-stats', controller.getAdminRevenueStats);

// Quan ly nha hang
router.post('/restaurants', controller.createRestaurant);
router.put('/restaurants/:id', controller.updateRestaurant);
router.get('/restaurants', controller.getRestaurants);
router.get('/restaurants/pending', controller.getPendingRestaurants);
router.put('/restaurants/:id/approve', controller.approveRestaurant);
router.put('/restaurants/:id/activate', controller.activateRestaurant);
router.put('/restaurants/:id/suspend', controller.suspendRestaurant);
router.post('/restaurants/:id/reject', controller.rejectRestaurant);

// Quan ly nguoi dung, booking, giao dich
router.post('/users/restaurant-owner', controller.createRestaurantOwner);
router.post('/users/owner/:id/reset-password', controller.resetOwnerPassword);
router.get('/users', controller.getUsers);
router.put('/users/:id', controller.updateUser);
router.delete('/users/:id', controller.deleteUser);
router.get('/bookings', controller.getBookings);
router.get('/transactions', controller.getTransactions);

// Quy trinh doi soat commission
router.post('/commissions/collect', controller.collectCommissions);
router.post('/commissions/settle-quarter', controller.settleQuarterCommission);

// Quy trinh duyet / tu choi rut tien
router.get('/withdrawals', controller.getWithdrawals);
router.post('/withdrawals/:id/approve', controller.approveWithdrawal);
router.post('/withdrawals/:id/reject', controller.rejectWithdrawal);

// Quan ly partner requests
// Quan ly partner requests (Doi tac dang ky moi)
router.get('/partner-requests', controller.getPartnerRequests);
router.post('/partner-requests/:id/approve', controller.approvePartnerRequest);
router.post('/partner-requests/:id/reject', controller.rejectPartnerRequest);

module.exports = router;
