/**
 * email.service.js - provider adapter for sending emails using nodemailer
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email notification
 * @param {string} to 
 * @param {string} subject 
 * @param {string} html 
 */
async function sendEmailNotification(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"SeatNow Admin" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent: %s', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { sent: false, error: error.message };
  }
}

module.exports = { sendEmailNotification };
