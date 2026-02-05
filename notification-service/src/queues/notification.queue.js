/**
 * notification.queue.js - queue definitions for notifications (placeholder)
 */
const Queue = require('bull');
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const emailQueue = new Queue('email', redisUrl);
const smsQueue = new Queue('sms', redisUrl);

module.exports = { emailQueue, smsQueue };
