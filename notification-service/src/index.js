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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3008;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Initialize Web Notification (Socket.io)
webNotificationService.init(io);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'up', service: 'notification-service' });
});

// Test Endpoint to trigger notifications via HTTP (for Postman/Internal use)
app.post('/api/v1/notifications/test', async (req, res) => {
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

// Attach Worker to Queue
notificationQueue.process(notificationWorker);

// Start Server
server.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
  console.log(`Socket.io server initialized`);
  console.log(`Bull worker attached to notificationQueue`);
  console.log(`http://localhost:${PORT}`);
});

