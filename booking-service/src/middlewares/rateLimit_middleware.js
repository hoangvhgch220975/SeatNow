/**
 * Rate limit middleware for booking-service
 * Simple Redis-based counter per IP + key
 */
const { getRedis } = require('../config/redis');

// default: 60 requests per 60 seconds
module.exports = ({ limit = 60, windowSec = 60, key } = {}) => async (req, res, next) => {
  const redis = await getRedis();
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
  const k = `ratelimit:${ip}:${key || (req.baseUrl + req.path)}`;
  try {
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, windowSec);
    if (n > limit) return res.status(429).json({ message: 'Too many requests' });
    next();
  } catch (err) {
    // If redis fails, allow request to proceed (fail-open)
    console.warn('[rateLimit] redis error', err && err.message);
    next();
  }
};
