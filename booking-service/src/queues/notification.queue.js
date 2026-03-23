/**
 * notification.queue.js - queue for sending notification jobs to notification-service
 */
const Queue = require('bull');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const notificationQueue = new Queue('notification', redisUrl);

module.exports = { notificationQueue };
