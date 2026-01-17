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
    { sub: userId, role, sid },
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

async function createSession({ userId, role }) {
  const sid = uuidv4();
  const ttl = parseExpiresToSeconds(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  await redis.set(`user:session:${sid}`, JSON.stringify({ userId, role }), 'EX', ttl);
  return sid;
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

  // require phone OTP verification
  if (!phone) throw Object.assign(new Error('PHONE_REQUIRED'), { status: 400 });
  if (!arguments[0]?.otp) throw Object.assign(new Error('OTP_REQUIRED'), { status: 400 });
  const otpOk = await otpUtil.verifyOtp(redis, phone, arguments[0].otp);
  if (!otpOk) throw Object.assign(new Error('OTP_INVALID_OR_EXPIRED'), { status: 400 });

  const role = mapAccountTypeToRole(accountType);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.createUser({ phone, email, name, passwordHash, role });

  const sid = await createSession({ userId: user.id, role: user.role });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    accessToken: signAccessToken({ userId: user.id, role: user.role, sid }),
    refreshToken: signRefreshToken({ userId: user.id, role: user.role, sid })
  };
}

async function login({ identifier, password }) {
  const user = await UserModel.findByPhoneOrEmail({ phone: identifier, email: identifier });
  if (!user) throw Object.assign(new Error('INVALID_CREDENTIALS'), { status: 401 });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw Object.assign(new Error('INVALID_CREDENTIALS'), { status: 401 });

  const sid = await createSession({ userId: user.id, role: user.role });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    accessToken: signAccessToken({ userId: user.id, role: user.role, sid }),
    refreshToken: signRefreshToken({ userId: user.id, role: user.role, sid })
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

  // rotate session
  await redis.del(sessionKey);

  const user = await UserModel.findById(payload.sub);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  const sid = await createSession({ userId: user.id, role: user.role });

  return {
    accessToken: signAccessToken({ userId: user.id, role: user.role, sid }),
    refreshToken: signRefreshToken({ userId: user.id, role: user.role, sid })
  };
}

async function logout({ refreshToken }) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (payload?.sid) await redis.del(`user:session:${payload.sid}`);
  } catch {
    // ignore
  }
  return { ok: true };
}

async function sendOtp({ phone }) {
  const code = otpUtil.genOtp();
  await otpUtil.saveOtp(redis, phone, code, 300);
  console.log(`[OTP] ${phone}: ${code}`); // DEV only
  return { ok: true };
}

async function verifyOtp({ phone, code }) {
  const ok = await otpUtil.verifyOtp(redis, phone, code);
  if (!ok) throw Object.assign(new Error('OTP_INVALID_OR_EXPIRED'), { status: 400 });
  return { ok: true };
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

  const sid = await createSession({ userId: user.id, role: user.role });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
    accessToken: signAccessToken({ userId: user.id, role: user.role, sid }),
    refreshToken: signRefreshToken({ userId: user.id, role: user.role, sid })
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
