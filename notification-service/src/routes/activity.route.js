/**
 * activity.route.js - Định nghĩa các route cho Owner Activity Feed
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireOwnerOrAdmin } = require('../middleware/auth.middleware');
const activityController = require('../controllers/activity.controller');

// Lấy danh sách hoạt động gần đây (phân trang, lọc theo loại)
router.get('/', requireAuth, requireOwnerOrAdmin, activityController.getOwnerActivity);

// QUAN TRỌNG: Route cụ thể (read-all) phải khai báo TRƯỚC route động (:id/read)
// để tránh Express hiểu "read-all" là một :id

// Đánh dấu TẤT CẢ thông báo là đã đọc
router.put('/read-all', requireAuth, requireOwnerOrAdmin, activityController.markAllAsRead);

// Đánh dấu một thông báo cụ thể là đã đọc
router.put('/:id/read', requireAuth, requireOwnerOrAdmin, activityController.markAsRead);

module.exports = router;
