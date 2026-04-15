/**
 * notification.queue.js - queue definitions for notifications
 */
const Queue = require('bull');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// We use a single unified queue for all notification types
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

// Log cảnh báo khi job thất bại hoàn toàn (hết số lần retry)
notificationQueue.on('failed', (job, err) => {
  console.error(`[NotifQueue] Job ${job.id} (type=${job.data?.type}, event=${job.data?.payload?.event}) FAILED after ${job.opts.attempts} attempts:`, err.message);
});

// Log cảnh báo khi sắp retry
notificationQueue.on('waiting', (jobId) => {
  console.log(`[NotifQueue] Job ${jobId} waiting in queue`);
});

// Optional: specific queues if needed in the future
// const emailQueue = new Queue('email', redisUrl);
// const smsQueue = new Queue('sms', redisUrl);

module.exports = { 
  notificationQueue 
};
