/**
 * notification.worker.js - consolidated worker to process all types of notification jobs
 */
const emailService = require('../services/email.service');
const firebaseService = require('../services/firebase.service');
const webNotificationService = require('../services/web-notification.service');
const templates = require('../utils/template_helper');

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
