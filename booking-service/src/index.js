/**
 * booking-service index - bootstrap express app (placeholder)
 */
const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mount routes
const bookingRoutes = require('./routes/booking.route');
app.use('/api/v1/bookings', bookingRoutes);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`booking-service listening on ${PORT}`));
