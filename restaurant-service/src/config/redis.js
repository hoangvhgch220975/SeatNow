const { createClient } = require('redis');

class RedisClient {
  static instance;

  static getInstance() {
    if (!RedisClient.instance) {
      const client = createClient({ url: process.env.REDIS_URL });
      client.on('error', (err) => console.error('Redis error:', err));
      RedisClient.instance = client;
    }
    return RedisClient.instance;
  }
}

async function initRedis() {
  const client = RedisClient.getInstance();
  if (!client.isOpen) await client.connect();
  return client;
}

module.exports = { RedisClient, initRedis };
