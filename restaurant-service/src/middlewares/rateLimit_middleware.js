/**
 * Rate limit middleware placeholder
 * Implement real rate limiting (express-rate-limit / redis) when required.
 */
const { getRedis, initRedis } = require('../config/redis');

// Đặt giới hạn mặc định: 60 requests mỗi 60 giây
module.exports = ({ limit = 60, windowSec = 60, key } = {}) => async (req, res, next) => {
  const redis = await initRedis();
// Lấy địa chỉ IP của client
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
// Tạo khóa duy nhất cho IP và endpoint
  const k = `ratelimit:${ip}:${key || (req.baseUrl + req.path)}`;
// Tăng bộ đếm trong Redis và kiểm tra giới hạn
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  if (n > limit) return res.status(429).json({ message: 'Too many requests' });
  next();
};
