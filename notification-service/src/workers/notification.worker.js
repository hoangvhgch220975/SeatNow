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
 * Payment service sends walletId instead of userId when processing TOPUP / WITHDRAW
 */
async function resolveOwnerIdFromWalletId(walletId) {
  if (!walletId) return null;
  try {
    const { sql, getPool } = require('../config/db');
    const pool = await getPool();
    // Wallet can be attached to a Restaurant (restaurantId) or Admin (userId)
    // For restaurant wallet: lookup Restaurant.ownerId
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
        } else if (templateType === 'restaurant_reactivated') {
          html = templates.getRestaurantReactivatedTemplate(data);
          subject = subject || `[SeatNow] Your restaurant "${data.restaurantName}" has been reactivated!`;
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

        // If no userId but walletId is present → resolve from DB (TOPUP, WITHDRAW_APPROVED)
        let resolvedUserId = payload.ownerId || payload.userId;
        if (!resolvedUserId && payload.walletId) {
          resolvedUserId = await resolveOwnerIdFromWalletId(payload.walletId);
          if (resolvedUserId) {
            console.log(`[Worker] Resolved userId=${resolvedUserId} from walletId=${payload.walletId}`);
          }
        }
        
        // 1. Send Real-time via Socket FIRST so user receives it instantly
        if (payload.role) {
          webNotificationService.sendRoleNotification(
            payload.role,
            payload.event || 'notification',
            payload
          );
        } else {
          webNotificationService.sendWebNotification(
            resolvedUserId || payload.userId,
            payload.event || 'notification',
            payload
          );
        }

        // 2. Automatically save to DB if ownerId is present
        // Wrap in try-catch so DB errors (SQL Constraints) don't break Real-time delivery
        if (resolvedUserId) {
          try {
            await notificationModel.saveNotification({
              ownerId:      resolvedUserId,
              restaurantId: payload.restaurantId || null,
              type:         (payload.activityType || payload.event || 'SYSTEM').toUpperCase(),
              title:        payload.title        || notifTitles[payload.event] || payload.event || 'Notification',
              message:      payload.message      || '',
              metadata:     payload.data         || payload.metadata || null
            });
          } catch (dbErr) {
            console.error('[Worker] DB Save Failed (Check SQL Constraints):', dbErr.message);
            // Do not throw error here to complete job and not lose Real-time
          }
        }

        return { success: true };
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
