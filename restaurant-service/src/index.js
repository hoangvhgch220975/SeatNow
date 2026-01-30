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
const { getRedis } = require('./config/redis');

const restaurantRoutes = require('./routes/restaurant_route');

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', async (_req, res) => {
  try {
    await Promise.all([getPool(), connectMongo(), getRedis()]);
    res.json({ ok: true  , service: 'restaurant-service' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api/v1/restaurants', restaurantRoutes);

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`[restaurant-service] listening on ${port}`));
console.log('http://localhost:' + port);
