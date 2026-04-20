require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const adminRoute = require('./routes/admin_route');
const { getPool } = require('./config/sql');
const { errorMiddleware } = require('./middlewares/error_middleware');
const { initCommissionWorker } = require('./workers/commission_worker');

const app = express();

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
	try {
		await getPool();
		return res.json({ 
			status: 'UP', 
			service: 'admin-service',
			timestamp: new Date().toISOString(),
			details: { database: 'up' }
		});
	} catch (err) {
		return res.status(500).json({ 
			status: 'DOWN', 
			service: 'admin-service',
			timestamp: new Date().toISOString(),
			details: { database: 'down' },
			error: err.message 
		});
	}
});

const configRoute = require('./routes/config_route');

app.use('/api/v1/admin', adminRoute);
app.use('/api/v1/admin/configs', configRoute);
app.use(errorMiddleware);

async function bootstrap() {
	await getPool();
	
	// Khoi tao worker chay ngam
	initCommissionWorker();

	const port = process.env.PORT || 3006;
	app.listen(port, () => {
		console.log(`admin-service listening on ${port}`);
		console.log(`http://localhost:${port}`);
	});
}

bootstrap().catch((err) => {
	console.error('Bootstrap failed:', err);
	process.exit(1);
});
