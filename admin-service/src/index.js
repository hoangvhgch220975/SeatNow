require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const adminRoute = require('./routes/admin_route');
const { getPool } = require('./config/sql');
const { errorMiddleware } = require('./middlewares/error_middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
	try {
		await getPool();
		return res.json({ success: true, service: 'admin-service' });
	} catch (err) {
		return res.status(500).json({ success: false, message: err.message });
	}
});

app.use('/api/v1/admin', adminRoute);
app.use(errorMiddleware);

async function bootstrap() {
	await getPool();

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
