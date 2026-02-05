/**
 * admin-service index - bootstrap express app (placeholder)
 */
const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const adminRoutes = require('./routes/admin.route');
app.use('/api/v1/admin', adminRoutes);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`admin-service listening on ${PORT}`));
