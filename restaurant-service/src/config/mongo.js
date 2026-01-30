const mongoose = require('mongoose');

let connected = false;

async function connectMongo() {
  if (connected) return mongoose;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGO_URI');
  await mongoose.connect(uri);
  connected = true;
  console.log('[mongo] connected');
  return mongoose;
}

module.exports = { mongoose, connectMongo };
