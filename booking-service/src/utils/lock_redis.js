/**
 * lock.redis.js - simple Redis lock helper (placeholder)
 */
const crypto = require('crypto');

async function acquireLock(redis, key, ttlSec) {
  const token = crypto.randomBytes(16).toString('hex');
  const ok = await redis.set(key, token, { NX: true, EX: ttlSec });
  return ok ? token : null;
}

async function releaseLock(redis, key, token) {
  const lua = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  try { await redis.eval(lua, { keys: [key], arguments: [token] }); } catch (err) {
    console.warn('[releaseLock] failed', {
      key,
      message: err?.message || String(err),
    });
  }
}

module.exports = { acquireLock, releaseLock };
