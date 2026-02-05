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

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Try to initialize backing services on startup so handlers don't block
Promise.allSettled([getPool(), getRedis()])
  .then((results) => {
    results.forEach((r) => {
      if (r.status === 'rejected') console.warn('[startup] service init failed', r.reason && r.reason.message ? r.reason.message : r.reason);
    });
    // start jobs only after initial DB attempt
    try { startBookingJobs(); } catch (e) { /* ignore */ }
  });

app.get('/health', async (_req, res) => {
  try {
    await Promise.all([getPool(), getRedis()]);
    res.json({ ok: true, service: 'booking-service' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api/v1', BookingRoutes);

const server = http.createServer(app);
socket.initSocket(server);

const port = process.env.PORT || 3004;
server.listen(port, () => console.log(`[booking-service] listening on ${port}`));
console.log('http://localhost:' + port);
