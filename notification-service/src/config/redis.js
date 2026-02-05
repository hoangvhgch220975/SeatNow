/**
 * redis.js - Redis client used by the notification worker (placeholder)
 */
const Redis = require('ioredis');

const client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
module.exports = client;
