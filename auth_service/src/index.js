require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth_route');
const { initRedis } = require('./config/redis');
const { initFirebase } = require('./config/firebase');

const app = express();

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', async (req, res) => {
  const details = { database: 'down', redis: 'down' };
  try {
    const { getPool } = require('./config/db');
    await Promise.all([
      getPool().then(() => details.database = 'up'),
      initRedis().then(() => details.redis = 'up')
    ]);
    res.json({
      status: 'UP',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      details
    });
  } catch (err) {
    res.status(500).json({
      status: 'DOWN',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      details,
      error: err.message
    });
  }
});

app.use('/api/v1/auth', authRoutes);

app.use((err, req, res, next) => {
  // Log error (don't crash the process)
  console.error(err && err.stack ? err.stack : err);
  const status = err && err.status ? err.status : 400;
  res.status(status).json({ message: err.message || 'Bad Request' });
});

async function bootstrap() {
  await initRedis();
  initFirebase();

  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`auth-service listening on :${port}`));
  console.log('http://localhost:' + port);
}

bootstrap().catch((e) => {
  console.error('Failed to start auth-service:', e);
  process.exit(1);
});
