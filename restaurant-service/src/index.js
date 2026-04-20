/**
 * restaurant-service - entry point (placeholder)
 * This file is intentionally minimal; replace with real mounting
 * of routes and middleware when implementing the service.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectMongo } = require('./config/mongo');
const { getPool } = require('./config/sql');
const { initRedis } = require('./config/redis');

const restaurantRoutes = require('./routes/restaurant_route');

const app = express();
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Try to initialize backing services on startup so handlers don't block
Promise.allSettled([getPool(), connectMongo(), initRedis()])
  .then((results) => {
    results.forEach((r) => {
      if (r.status === 'rejected') console.warn('[startup] service init failed', r.reason && r.reason.message ? r.reason.message : r.reason);
    });
  });

app.get('/health', async (_req, res) => {
  const details = { database: 'down', mongodb: 'down', redis: 'down' };
  try {
    await Promise.all([
      getPool().then(() => details.database = 'up'),
      connectMongo().then(() => details.mongodb = 'up'),
      initRedis().then(() => details.redis = 'up')
    ]);
    res.json({
      status: 'UP',
      service: 'restaurant-service',
      timestamp: new Date().toISOString(),
      details
    });
  } catch (e) {
    res.status(500).json({
      status: 'DOWN',
      service: 'restaurant-service',
      timestamp: new Date().toISOString(),
      details,
      error: e.message
    });
  }
});

app.use('/api/v1', restaurantRoutes);

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`[restaurant-service] listening on ${port}`));
console.log('http://localhost:' + port);
