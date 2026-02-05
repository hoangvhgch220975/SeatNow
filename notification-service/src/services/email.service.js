/**
 * email.service.js - provider adapter for sending emails (placeholder)
 */
const sender = require('../utils/sender');

async function sendEmailNotification(to, subject, html) {
  // Integrate with SendGrid/Nodemailer here
  await sender.sendEmail(to, subject, html);
  return { sent: true };
}

module.exports = { sendEmailNotification };
