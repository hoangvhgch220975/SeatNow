/**
 * admin_activity.route.js - Định nghĩa các route cho Admin Global Activity Feed
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const activityController = require('../controllers/activity.controller');

// Đăng nhập và phải có role ADMIN
router.use(requireAuth, requireRole('ADMIN'));

// Lấy danh sách hoạt động hệ thống (ownerId IS NULL)
router.get('/', activityController.getAdminActivity);

// Đánh dấu MỘT thông báo hệ thống là đã đọc
router.put('/:id/read', activityController.markAdminAsRead);

// Đánh dấu TẤT CẢ thông báo hệ thống là đã đọc
router.put('/read-all', activityController.markAllAdminAsRead);

module.exports = router;
