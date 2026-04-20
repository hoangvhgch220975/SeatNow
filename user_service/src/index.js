require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const userRoutes = require('./routes/user_route');

const app = express();
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', async (req, res) => {
  const details = { database: 'down' };
  try {
    const { getPool } = require('./config/db');
    await getPool();
    details.database = 'up';
    res.json({
      status: 'UP',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      details
    });
  } catch (err) {
    res.status(500).json({
      status: 'DOWN',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      details,
      error: err.message
    });
  }
});

app.use('/api/v1/users', userRoutes);

const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`user-service listening on :${port}`));
console.log(`http://localhost:${port}`);
