// src/services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const UserModel = require('../models/user_model');
const { RedisClient } = require('../config/redis');
const { getFirebaseAdmin } = require('../config/firebase');
const otpUtil = require('../utils/otp_util');

const redis = RedisClient.getInstance();

function mapAccountTypeToRole(accountType) {
  const t = String(accountType || '').toLowerCase();
  if (t === 'restaurant_owner' || t === 'restaurant' || t === 'partner') return 'RESTAURANT_OWNER';
  return 'CUSTOMER';
}

function signAccessToken({ userId, role, sid }) {
  return jwt.sign(
    { sub: userId, role, sid, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken({ userId, role, sid }) {
  return jwt.sign(
    { sub: userId, role, sid, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

function parseExpiresToSeconds(expires) {
  const m = /^(\d+)(s|m|h|d)$/.exec(String(expires || '').trim());
  if (!m) return 7 * 24 * 60 * 60;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * mult;
}

function createSid() {
  return uuidv4();
}

async function persistSession({ sid, userId, role, refreshToken }) {
  const ttl = parseExpiresToSeconds(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  const payload = { sid, userId, role, refreshToken: refreshToken || null, rotatedAt: new Date().toISOString() };
  await redis.set(`user:session:${sid}`, JSON.stringify(payload), { EX: ttl });
  return true;
}

// ====== PUBLIC API ======
async function register({ phone, email, name, password, accountType }) {
  // check tồn tại (phone/email unique)
  const byPhone = await UserModel.findByPhoneOrEmail({ phone });
  if (byPhone) throw Object.assign(new Error('PHONE_ALREADY_EXISTS'), { status: 409 });

  if (email) {
    const byEmail = await UserModel.findByPhoneOrEmail({ email });
    if (byEmail) throw Object.assign(new Error('EMAIL_ALREADY_EXISTS'), { status: 409 });
  }

  // require phone verification: either Firebase ID token (phone auth) OR local OTP
  if (!phone) throw Object.assign(new Error('PHONE_REQUIRED'), { status: 400 });

  const firebaseToken = arguments[0]?.firebaseToken || null;
  if (firebaseToken) {
    const admin = getFirebaseAdmin();
    if (!admin) throw Object.assign(new Error('FIREBASE_NOT_CONFIGURED'), { status: 500 });
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(firebaseToken);
    } catch (err) {
      throw Object.assign(new Error('INVALID_FIREBASE_TOKEN'), { status: 401 });
    }
    const phoneNumber = decoded.phone_number || null;
    if (!phoneNumber) throw Object.assign(new Error('FIREBASE_PHONE_NOT_VERIFIED'), { status: 400 });
    // normalize comparison: prefer full E.164 match
    if (phone && String(phoneNumber).replace(/\s+/g, '') !== String(phone).replace(/\s+/g, '')) {
      throw Object.assign(new Error('PHONE_MISMATCH_WITH_FIREBASE'), { status: 400 });
    }
  } else {
    if (!arguments[0]?.otp) throw Object.assign(new Error('OTP_REQUIRED'), { status: 400 });
    await verifyOtp({ phone, code: arguments[0].otp });
  }

  const role = mapAccountTypeToRole(accountType);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.createUser({ phone, email, name, passwordHash, role });

  const sid = createSid();
  const accessToken = signAccessToken({ userId: user.id, role: user.role, sid });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, sid });
  await persistSession({ sid, userId: user.id, role: user.role, refreshToken });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken
  };
}

async function login({ identifier, password }) {
  const user = await UserModel.findByPhoneOrEmail({ phone: identifier, email: identifier });
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw Object.assign(new Error('INVALID_PASSWORD'), { status: 401 });

  const sid = createSid();
  const accessToken = signAccessToken({ userId: user.id, role: user.role, sid });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, sid });
  await persistSession({ sid, userId: user.id, role: user.role, refreshToken });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    accessToken: { accessToken, expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
    refreshToken: { refreshToken, expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  };
}

async function refreshToken({ refreshToken }) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('INVALID_REFRESH_TOKEN'), { status: 401 });
  }

  if (payload.type !== 'refresh' || !payload.sid) {
    throw Object.assign(new Error('INVALID_REFRESH_TOKEN'), { status: 401 });
  }

  const sessionKey = `user:session:${payload.sid}`;
  const sessionRaw = await redis.get(sessionKey);
  if (!sessionRaw) throw Object.assign(new Error('SESSION_EXPIRED'), { status: 401 });

  let sessionObj = null;
  try {
    sessionObj = JSON.parse(sessionRaw);
  } catch (e) {
    await redis.del(sessionKey).catch(() => {});
    throw Object.assign(new Error('SESSION_INVALID'), { status: 401 });
  }

  // optional check: ensure presented refresh token matches stored one
  if (sessionObj.refreshToken && sessionObj.refreshToken !== refreshToken) {
    throw Object.assign(new Error('INVALID_REFRESH_TOKEN'), { status: 401 });
  }

  // rotate session: remove old and create new
  await redis.del(sessionKey);

  const user = await UserModel.findById(payload.sub);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  const sid = createSid();
  const newAccessToken = signAccessToken({ userId: user.id, role: user.role, sid });
  const newRefreshToken = signRefreshToken({ userId: user.id, role: user.role, sid });
  await persistSession({ sid, userId: user.id, role: user.role, refreshToken: newRefreshToken });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}

async function logout({ refreshToken }) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (payload?.sid) await redis.del(`user:session:${payload.sid}`);
  } catch {
    // ignore errors
  }
  return { ok: true };
}

async function sendOtp({ phone }) {
  // Anti-spam / rate limit checks
  const can = await otpUtil.canSendOtp(redis, phone, { cooldownSeconds: 60, maxPerWindow: 5, windowSeconds: 3600 });
  if (!can.ok) {
    const reason = can.reason === 'TOO_SOON' ? 'OTP_SEND_TOO_SOON' : 'OTP_SEND_RATE_LIMIT_EXCEEDED';
    throw Object.assign(new Error(reason), { status: 429 });
  }

  const code = otpUtil.genOtp();
  // Save OTP for 120 seconds (2 minutes)
  // Save OTP in Redis (2 minutes) but DO NOT send SMS from backend.
  // Frontend is responsible for delivering the OTP (e.g., using Twilio/Firebase).
  await otpUtil.saveOtp(redis, phone, code, 120);

  // record this send to enforce limits
  await otpUtil.recordOtpSent(redis, phone, { cooldownSeconds: 60, windowSeconds: 3600 });

  // Do not log or return the code in production. For safety we only return ok.
  return { ok: true };
}

async function verifyOtp({ phone, code }) {
  const res = await otpUtil.verifyOtp(redis, phone, code, parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS || '5', 10));
  if (res.ok) return { ok: true };
  if (res.reason === 'EXPIRED') throw Object.assign(new Error('OTP_EXPIRED'), { status: 400 });
  if (res.reason === 'INCORRECT') throw Object.assign(new Error('OTP_INCORRECT'), { status: 400 });
  if (res.reason === 'TOO_MANY_ATTEMPTS') throw Object.assign(new Error('OTP_MAX_ATTEMPTS_EXCEEDED'), { status: 429 });
  throw Object.assign(new Error('OTP_INVALID'), { status: 400 });
}

async function resetPassword({ phone, otp, newPassword }) {
  await verifyOtp({ phone, code: otp });

  const user = await UserModel.findByPhoneOrEmail({ phone });
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await UserModel.updatePasswordById(user.id, passwordHash);

  return { ok: true };
}

async function googleSignIn({ idToken, accountType, phone }) {
  const admin = getFirebaseAdmin();
  if (!admin) throw Object.assign(new Error('FIREBASE_NOT_CONFIGURED'), { status: 500 });

  const decoded = await admin.auth().verifyIdToken(idToken);

  const email = decoded.email || null;
  const name = decoded.name || 'Google User';
  const avatar = decoded.picture || null;
  const phoneNumber = decoded.phone_number || null;

  const createPhone = phoneNumber || phone || null;

  let user = null;
  if (email) user = await UserModel.findByPhoneOrEmail({ email });
  if (!user && createPhone) user = await UserModel.findByPhoneOrEmail({ phone: createPhone });

  if (!user) {
    if (!createPhone) throw Object.assign(new Error('PHONE_REQUIRED_FOR_GOOGLE_FIRST_LOGIN'), { status: 400 });

    const role = mapAccountTypeToRole(accountType);
    const passwordHash = await bcrypt.hash(uuidv4(), 10);

    user = await UserModel.createUser({
      phone: createPhone,
      email,
      name,
      passwordHash,
      role,
      avatar
    });
  }

  const sid = createSid();
  const accessToken = signAccessToken({ userId: user.id, role: user.role, sid });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, sid });
  await persistSession({ sid, userId: user.id, role: user.role, refreshToken });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
    accessToken,
    refreshToken
  };
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  sendOtp,
  verifyOtp,
  resetPassword,
  googleSignIn
};   
