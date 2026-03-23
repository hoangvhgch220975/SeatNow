/**
 * notification.queue.js - queue definitions for notifications
 */
const Queue = require('bull');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// We use a single unified queue for all notification types
const notificationQueue = new Queue('notification', redisUrl);

// Optional: specific queues if needed in the future
// const emailQueue = new Queue('email', redisUrl);
// const smsQueue = new Queue('sms', redisUrl);

module.exports = { 
  notificationQueue 
};
