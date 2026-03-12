const { createClient } = require('redis');
require('dotenv').config();

let client;

async function getRedis() {
  if (client) return client;

  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();

  return client;
}

module.exports = { getRedis };