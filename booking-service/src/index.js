/**
 * booking-service index - bootstrap express app
 */
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const BookingRoutes = require('./routes/booking_route');
const { getPool } = require('./config/db');
const { getRedis } = require('./config/redis');
const { startBookingJobs } = require('./jobs/bookingExpire.job');
const socket = require('./sockets/booking_socket');
const { initRedisSubscriber } = require('./services/redis_subscriber_service');

const app = express();
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5500', 'http://127.0.0.1:5500'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Thử khởi tạo các dịch vụ nền khi startup
Promise.allSettled([getPool(), getRedis(), initRedisSubscriber()])
  .then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const services = ['DB Pool', 'Redis Client', 'Redis Subscriber'];
        console.warn(`[startup] ${services[i]} init failed`, r.reason && r.reason.message ? r.reason.message : r.reason);
      }
    });
    // start jobs only after initial DB attempt
    try { startBookingJobs(); } catch (e) { /* ignore */ }
  });

app.get('/health', async (_req, res) => {
  const details = { database: 'down', redis: 'down' };
  try {
    await Promise.all([
      getPool().then(() => details.database = 'up'),
      getRedis().then(() => details.redis = 'up')
    ]);
    res.json({
      status: 'UP',
      service: 'booking-service',
      timestamp: new Date().toISOString(),
      details
    });
  } catch (e) {
    res.status(500).json({
      status: 'DOWN',
      service: 'booking-service',
      timestamp: new Date().toISOString(),
      details,
      error: e.message
    });
  }
});

app.use('/api/v1', BookingRoutes);

const server = http.createServer(app);
socket.initSocket(server);

const port = process.env.PORT || 3004;
server.listen(port, () => console.log(`[booking-service] listening on ${port}`));
console.log('http://localhost:' + port);
