/**
 * index.js - bootstrapping the notification-service
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const webNotificationService = require('./services/web-notification.service');
const { notificationQueue } = require('./queues/notification.queue');
const notificationWorker = require('./workers/notification.worker');
const activityRouter = require('./routes/activity.route');
const adminActivityRouter = require('./routes/admin_activity.route');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/notification.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3008;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Initialize Web Notification (Socket.io)
webNotificationService.init(io);

// Health Check
app.get('/health', async (req, res) => {
  const details = { redis: 'down' };
  try {
    // Check if queue client is connected
    if (notificationQueue.client.status === 'ready') {
      details.redis = 'up';
    }
    res.json({
      status: 'UP',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      details
    });
  } catch (err) {
    res.status(500).json({
      status: 'DOWN',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      details,
      error: err.message
    });
  }
});

// Trigger notifications via HTTP (Internal Service Use)
app.post('/api/v1/notifications', async (req, res) => {
  const { type, payload } = req.body;
  if (!type || !payload) {
    return res.status(400).json({ error: 'Missing type or payload' });
  }

  try {
    const job = await notificationQueue.add({ type, payload });
    res.json({ success: true, jobId: job.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Owner Activity Feed Routes ───────────────────────────────────────────────
// Gắn toàn bộ các route activity vào prefix /api/v1/owner/activity
app.use('/api/v1/owner/activity', activityRouter);
app.use('/api/v1/admin/activity', adminActivityRouter);

// Attach Worker to Queue
notificationQueue.process(notificationWorker);

// Start Server
server.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
  console.log(`Socket.io server initialized`);
  console.log(`Bull worker attached to notificationQueue`);
  console.log(`http://localhost:${PORT}`);
});

