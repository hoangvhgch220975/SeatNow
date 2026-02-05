/**
 * payment-service index - bootstrap express app (placeholder)
 */
const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const paymentRoutes = require('./routes/payment.route');
app.use('/api/v1/payments', paymentRoutes);

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`payment-service listening on ${PORT}`));
