/**
 * redis.js - redis client placeholder for booking-service
 */
const { createClient } = require('redis');

let client;

async function getRedis() {
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (e) => console.warn('[redis]', e.message));
  await client.connect();
  return client;
}

module.exports = { getRedis };
