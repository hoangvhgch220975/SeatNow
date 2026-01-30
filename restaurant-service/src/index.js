const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3002;
  app.listen(port, () => console.log(`restaurant-service listening on ${port}`));
}
