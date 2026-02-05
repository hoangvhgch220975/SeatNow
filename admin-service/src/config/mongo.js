/**
 * mongo.js - Mongo connection placeholder for admin-service (analytics/logs)
 */
const mongoose = require('mongoose');

async function connect(uri) {
  uri = uri || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');
  return mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
}

module.exports = { connect };
