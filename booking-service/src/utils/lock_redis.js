/**
 * lock.redis.js - simple Redis lock helper (placeholder)
 */
const client = require('../config/redis');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function acquireLock(redis, key, ttlSec) {
  const ok = await redis.set(key, 'locked', { NX: true, EX: ttlSec });
  return !!ok;
}

async function releaseLock(redis, key) {
  try { await redis.del(key); } catch (_) {}
}

module.exports = { acquireLock, releaseLock, sleep }