/**
 * redis.js - redis client placeholder for booking-service
 */
const Redis = require('ioredis');
const client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
module.exports = client;
