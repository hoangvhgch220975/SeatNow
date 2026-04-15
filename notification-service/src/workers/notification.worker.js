/**
 * notification.worker.js - consolidated worker to process all types of notification jobs
 */
const emailService = require('../services/email.service');
const firebaseService = require('../services/firebase.service');
const webNotificationService = require('../services/web-notification.service');
const templates = require('../utils/template_helper');
const notificationModel = require('../models/notification.model');
const notifTitles = require('../utils/notif_titles');

/**
 * Resolve userId from walletId by querying DB
 * Payment service gửi walletId thay vì userId khi xử lý TOPUP / WITHDRAW
 */
async function resolveOwnerIdFromWalletId(walletId) {
  if (!walletId) return null;
  try {
    const { sql, getPool } = require('../config/db');
    const pool = await getPool();
    // Wallet có thể gắn với Restaurant (restaurantId) hoặc Admin (userId)
    // Với restaurant wallet: lookup Restaurant.ownerId
    const rs = await pool.request()
      .input('walletId', sql.UniqueIdentifier, walletId)
      .query(`
        SELECT TOP 1 w.userId, r.ownerId
        FROM dbo.Wallets w
        LEFT JOIN dbo.Restaurants r ON r.id = w.restaurantId
        WHERE w.id = @walletId
      `);
    const row = rs.recordset[0];
    if (!row) return null;
    return row.ownerId || row.userId || null;
  } catch (err) {
    console.warn('[Worker] resolveOwnerIdFromWalletId failed:', err.message);
    return null;
  }
}

/**
 * Main processor for the notification queue
 * @param {object} job 
 */
module.exports = async function processNotification(job) {
  const { type, payload } = job.data;
  console.log(`Processing notification job ${job.id} type: ${type}`);

  try {
    switch (type) {
      case 'email': {
        let { to, subject, html, templateType, data } = payload;
        
        // If a templateType is provided, generate the professional HTML
        if (templateType === 'booking_confirmed') {
          html = templates.getBookingConfirmedTemplate(data);
          subject = subject || `[SeatNow] Booking Confirmed - ${data.bookingCode}`;
        } else if (templateType === 'booking_cancelled') {
          html = templates.getBookingCancelledTemplate(data);
          subject = subject || `[SeatNow] Booking Cancelled - ${data.bookingCode}`;
        } else if (templateType === 'promotion') {
          html = templates.getPromotionTemplate(data);
          subject = subject || `[SeatNow] Special Offer from ${data.restaurantName}`;
        } else if (templateType === 'restaurant_activated') {
          html = templates.getRestaurantActivatedTemplate(data);
          subject = subject || `[SeatNow] Your restaurant "${data.restaurantName}" is now active!`;
        }

        return await emailService.sendEmailNotification(to, subject, html);
      }

      case 'push':
      case 'sms': // Replacement using Firebase Push
        return await firebaseService.sendPushNotification(
          payload.token || payload.to, 
          payload.title, 
          payload.body,
          payload.data
        );

      case 'web': {
        console.log(`Worker: Emitting web notification for event: ${payload.event || 'notification'}`, payload);

        // Nếu không có userId nhưng có walletId → resolve từ DB (TOPUP, WITHDRAW_APPROVED)
        let resolvedUserId = payload.ownerId || payload.userId;
        if (!resolvedUserId && payload.walletId) {
          resolvedUserId = await resolveOwnerIdFromWalletId(payload.walletId);
          if (resolvedUserId) {
            console.log(`[Worker] Resolved userId=${resolvedUserId} from walletId=${payload.walletId}`);
          }
        }
        
        // Tự động lưu vào DB nếu có đầy đủ thông tin ownerId
        if (resolvedUserId) {
          try {
            await notificationModel.saveNotification({
              ownerId:      resolvedUserId,
              restaurantId: payload.restaurantId || null,
              type:         (payload.activityType || payload.event || 'SYSTEM').toUpperCase(),
              title:        payload.title        || notifTitles[payload.event] || payload.event || 'Notification',
              message:      payload.message      || '',
              metadata:     payload.data         || null
            });
          } catch (dbErr) {
            // Lỗi lưu DB -> Bắt buộc throw để Worker Retry (ngăn mất thông báo vĩnh viễn)
            console.warn('[Worker] Failed to persist notification to DB. Triggering retry...', dbErr.message);
            throw new Error(`DB Save Failed: ${dbErr.message}`);
          }
        }

        if (payload.role) {
          return webNotificationService.sendRoleNotification(
            payload.role,
            payload.event || 'notification',
            payload
          );
        }
        return webNotificationService.sendWebNotification(
          resolvedUserId || payload.userId,
          payload.event || 'notification',
          payload
        );
      }

      default:
        console.warn(`Unknown notification type: ${type}`);
        return { error: 'Unknown type' };
    }
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    throw error; // Rethrow to allow Bull to attempt retries
  }
};
