/**
 * sender.js - wrapper for sending notifications (placeholder)
 */
async function sendEmail(to, subject, body) {
  console.log('sendEmail placeholder', to, subject);
}

async function sendSMS(to, msg) {
  console.log('sendSMS placeholder', to, msg);
}

module.exports = { sendEmail, sendSMS };
