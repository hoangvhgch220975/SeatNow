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
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/v1/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ message: err.message || 'Bad Request' });
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
