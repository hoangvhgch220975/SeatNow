// idempotency.js
// Muc dich: cac ham ho tro tao/xac minh khoa idempotency cho webhook va callback thanh toan.
// Cach dung thong thuong:
//  - truoc khi xu ly webhook, goi `acquireIdempotency(key)` de luu khoa vao Redis
//    va tra ve false neu yeu cau da duoc xu ly truoc do.

const { getRedis } = require('../config/redis');

async function acquireIdempotency(key, ttl = 300) {
  const redis = await getRedis();
  const ok = await redis.set(key, '1', { NX: true, EX: ttl });
  return !!ok;
}

module.exports = { acquireIdempotency };