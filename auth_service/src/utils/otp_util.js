function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

// Save OTP with TTL (default 120s)
async function saveOtp(redis, phone, code, ttlSeconds = 120) {
  await redis.set(`otp:${phone}`, code, { EX: ttlSeconds });
  // reset verify attempts counter when a new code is issued
  await redis.del(`otp:attempts:${phone}`);
}

// Check whether we can send an OTP to this phone (anti-spam):
// - cooldownSeconds: minimal seconds between sends (default 60s)
// - maxPerWindow: max sends allowed within windowSeconds (default 5 per hour)
async function canSendOtp(redis, phone, { cooldownSeconds = 60, maxPerWindow = 5, windowSeconds = 3600 } = {}) {
  const cooldownKey = `otp:sent_cooldown:${phone}`;
  if (await redis.get(cooldownKey)) return { ok: false, reason: 'TOO_SOON' };

  const countKey = `otp:sent_count:${phone}`;
  const countRaw = await redis.get(countKey);
  const count = parseInt(countRaw || '0', 10);
  if (count >= maxPerWindow) return { ok: false, reason: 'RATE_LIMIT_EXCEEDED' };

  return { ok: true };
}

async function recordOtpSent(redis, phone, { cooldownSeconds = 60, windowSeconds = 3600 } = {}) {
  const countKey = `otp:sent_count:${phone}`;
  const cooldownKey = `otp:sent_cooldown:${phone}`;

  const newCount = await redis.incr(countKey);
  if (newCount === 1) await redis.expire(countKey, windowSeconds);
  await redis.set(cooldownKey, '1', { EX: cooldownSeconds });
}

// Verify OTP with max attempts protection. Returns reasoned result object:
// { ok: true } on success
// { ok: false, reason: 'EXPIRED'|'INCORRECT'|'TOO_MANY_ATTEMPTS' }
async function verifyOtp(redis, phone, code, maxAttempts = 5) {
  const key = `otp:${phone}`;
  const saved = await redis.get(key);
  if (!saved) return { ok: false, reason: 'EXPIRED' };

  const attemptsKey = `otp:attempts:${phone}`;
  const attempts = await redis.incr(attemptsKey);
  // ensure attempts counter expires when otp expires; try to set a long-ish TTL only if first increment
  if (attempts === 1) {
    const ttl = 120; // match OTP TTL default; callers may use different TTL but 120s is default
    await redis.expire(attemptsKey, ttl);
  }

  if (attempts > maxAttempts) {
    // invalidate OTP and attempts to block further tries
    await redis.del(key);
    await redis.del(attemptsKey);
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  const ok = saved === String(code);
  if (ok) {
    await redis.del(key);
    await redis.del(attemptsKey);
    return { ok: true };
  }

  return { ok: false, reason: 'INCORRECT' };
}

module.exports = { genOtp, saveOtp, verifyOtp, canSendOtp, recordOtpSent };
 