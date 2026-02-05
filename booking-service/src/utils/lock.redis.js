/**
 * lock.redis.js - simple Redis lock helper (placeholder)
 */
const client = require('../config/redis');

async function acquireLock(key, ttlMs) {
  const token = Date.now() + ':' + Math.random();
  const ok = await client.set(key, token, 'PX', ttlMs, 'NX');
  return ok ? token : null;
}

async function releaseLock(key, token) {
  const val = await client.get(key);
  if (val === token) {
    await client.del(key);
    return true;
  }
  return false;
}

module.exports = { acquireLock, releaseLock };
