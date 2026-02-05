/**
 * sms.service.js - provider adapter for sending SMS (placeholder)
 */
const sender = require('../utils/sender');

async function sendSMSNotification(to, message) {
  // Integrate with Twilio/SMS provider here
  await sender.sendSMS(to, message);
  return { sent: true };
}

module.exports = { sendSMSNotification };
