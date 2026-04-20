const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { getPool } = require('./config/db');
const { getRedis } = require('./config/redis');
const paymentRoute = require('./routes/payment_route');
const webhookRoute = require('./routes/webhook_route');
const { errorMiddleware } = require('./middlewares/error_middleware');

async function bootstrap() {
  await getPool();
  await getRedis();

  const app = express();
  const cronService = require('./services/cron_service');

  app.use(helmet());
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', async (req, res) => {
    const details = { database: 'down', redis: 'down' };
    try {
      await Promise.all([
        getPool().then(() => details.database = 'up'),
        getRedis().then(() => details.redis = 'up')
      ]);
      res.json({
        status: 'UP',
        service: 'payment-service',
        timestamp: new Date().toISOString(),
        details
      });
    } catch (err) {
      res.status(500).json({
        status: 'DOWN',
        service: 'payment-service',
        timestamp: new Date().toISOString(),
        details,
        error: err.message
      });
    }
  });

  app.get('/home', (req, res) => {
  res.json({ message: 'Welcome to the Payment Service Home Page' });
});
    app .get('/bookings/:bookingId', (req, res) => {
  const bookingId = req.params.bookingId;
  res.json({ message: `Booking details for ID: ${bookingId}` });
});
  app.use('/api/v1/payment', paymentRoute);
  app.use('/api/v1/payment', webhookRoute);
  app.use(errorMiddleware);

  app.listen(process.env.PORT || 3005, () => {
    console.log(`payment-service listening on ${process.env.PORT || 3005}`);
    console.log("http://localhost:" + (process.env.PORT || 3005));
    
    // Khoi chay cron jobs (Start cron jobs)
    cronService.initCronJobs();
  });
}


bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});