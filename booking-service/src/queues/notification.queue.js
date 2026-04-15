/**
 * notification.queue.js - queue for sending notification jobs to notification-service
 */
const Queue = require('bull');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const notificationQueue = new Queue('notification', redisUrl, {
  defaultJobOptions: {
    attempts: 3,           // Retry 3 lần nếu worker throw lỗi
    backoff: {
      type: 'exponential',
      delay: 2000          // 2s → 4s → 8s
    },
    removeOnComplete: 100, // Giữ 100 job done gần nhất để debug
    removeOnFail: 50       // Giữ 50 job lỗi gần nhất
  }
});

module.exports = { notificationQueue };
