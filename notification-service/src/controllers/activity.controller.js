/**
 * activity.controller.js - Controller xử lý các yêu cầu liên quan đến lịch sử hoạt động của Owner
 */
const notificationModel = require('../models/notification.model');

/**
 * Lấy danh sách hoạt động gần đây của Owner
 * GET /api/v1/owner/activity
 * Query params: limit, offset, type
 */
async function getOwnerActivity(req, res) {
  try {
    const ownerId = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit  || '20', 10), 50); // Tối đa 50 bản ghi/lần
    const offset = parseInt(req.query.offset || '0', 10);
    const type   = req.query.type || null;

    const result = await notificationModel.getOwnerActivity(ownerId, { limit, offset, type });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[getOwnerActivity] Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch activity feed.' });
  }
}

/**
 * Đánh dấu một thông báo là đã đọc
 * PUT /api/v1/owner/activity/:id/read
 */
async function markAsRead(req, res) {
  try {
    const ownerId = req.user.id;
    const { id }  = req.params;

    const updated = await notificationModel.markAsRead(id, ownerId);
    if (!updated) {
      return res.status(404).json({ message: 'Notification not found or access denied.' });
    }
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[markAsRead] Error:', err.message);
    res.status(500).json({ message: 'Failed to mark notification as read.' });
  }
}

/**
 * Đánh dấu TẤT CẢ thông báo là đã đọc
 * PUT /api/v1/owner/activity/read-all
 */
async function markAllAsRead(req, res) {
  try {
    const ownerId    = req.user.id;
    const updatedCount = await notificationModel.markAllAsRead(ownerId);
    res.json({ success: true, updatedCount, message: `${updatedCount} notifications marked as read.` });
  } catch (err) {
    console.error('[markAllAsRead] Error:', err.message);
    res.status(500).json({ message: 'Failed to mark all notifications as read.' });
  }
}

module.exports = { getOwnerActivity, markAsRead, markAllAsRead };
