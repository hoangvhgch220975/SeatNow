/**
 * notification.worker.js - consolidated worker to process all types of notification jobs
 */
const emailService = require('../services/email.service');
const firebaseService = require('../services/firebase.service');
const webNotificationService = require('../services/web-notification.service');
const templates = require('../utils/template_helper');
const notificationModel = require('../models/notification.model');

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

      case 'web':
        console.log(`Worker: Emitting web notification for event: ${payload.event || 'notification'}`, payload);
        
        // Tự động lưu vào DB nếu có đầy đủ thông tin ownerId
        if (payload.ownerId || payload.userId) {
          try {
            await notificationModel.saveNotification({
              ownerId:      payload.ownerId || payload.userId,
              restaurantId: payload.restaurantId || null,
              type:         payload.activityType || payload.event || 'SYSTEM',
              title:        payload.title        || payload.event || 'Notification',
              message:      payload.message      || '',
              metadata:     payload.data         || null
            });
          } catch (dbErr) {
            // Lỗi lưu DB không dừng việc gửi socket
            console.warn('[Worker] Failed to persist notification to DB:', dbErr.message);
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
          payload.userId,
          payload.event || 'notification',
          payload
        );

      default:
        console.warn(`Unknown notification type: ${type}`);
        return { error: 'Unknown type' };
    }
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    throw error; // Rethrow to allow Bull to attempt retries
  }
};
