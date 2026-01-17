function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

async function saveOtp(redis, phone, code, ttlSeconds = 300) {
  await redis.set(`otp:${phone}`, code, { EX: ttlSeconds });
}

async function verifyOtp(redis, phone, code) {
  const key = `otp:${phone}`;
  const saved = await redis.get(key);
  if (!saved) return false;
  const ok = saved === String(code);
  if (ok) await redis.del(key);
  return ok;
}

module.exports = { genOtp, saveOtp, verifyOtp };
 