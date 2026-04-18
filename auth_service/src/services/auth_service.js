// src/services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const UserModel = require('../models/user_model');
const axios = require('axios'); 
const { RedisClient } = require('../config/redis');
const { getFirebaseAdmin } = require('../config/firebase');
const otpUtil = require('../utils/otp_util');
const { sendNewPasswordEmail, sendWelcomeOwnerEmail, sendOtpEmail } = require('../utils/email_util');

const redis = RedisClient.getInstance();

function mapAccountTypeToRole(accountType) {
  const t = String(accountType || '').toLowerCase();
  if (t === 'restaurant_owner' || t === 'restaurant' || t === 'partner') return 'RESTAURANT_OWNER';
  return 'CUSTOMER';
}

function signAccessToken({ userId, role, sid }) {
  const secret = process.env.JWT_ACCESS_SECRET;
  console.log(`[AUTH_SERVICE_DEBUG] JWT_ACCESS_SECRET length: ${secret?.length || 0}`);
  return jwt.sign(
    { sub: userId, role, sid, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      audience: 'seatnow-client',
      issuer: 'seatnow-auth-service'
    }
  );
}

function signRefreshToken({ userId, role, sid }) {
  return jwt.sign(
    { sub: userId, role, sid, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      audience: 'seatnow-client',
      issuer: 'seatnow-auth-service'
    }
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
  // force all public registrations to CUSTOMER regardless of requested account type
  const role = 'CUSTOMER';
  
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
    // Verify OTP against email if phone verification is skipped/not used for OTP
    const verifyIdentifier = email || phone;
    await verifyOtp({ phone: verifyIdentifier, code: arguments[0].otp });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.createUser({ phone, email, name, passwordHash, role });

  const sid = createSid();
  const accessToken = signAccessToken({ userId: user.id, role: user.role, sid });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, sid });
  await persistSession({ sid, userId: user.id, role: user.role, refreshToken });

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    accessToken: { 
      accessToken, 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
    },
    refreshToken: { 
      refreshToken, 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
    }
  };
}

// ====== INTERNAL / ADMIN API ======
async function createRestaurantOwnerByAdmin({ phone, email, name, avatar }) {
  // check tồn tại (phone/email unique)
  const byPhone = await UserModel.findByPhoneOrEmail({ phone });
  if (byPhone) throw Object.assign(new Error('PHONE_ALREADY_EXISTS'), { status: 409 });

  if (email) {
    const byEmail = await UserModel.findByPhoneOrEmail({ email });
    if (byEmail) throw Object.assign(new Error('EMAIL_ALREADY_EXISTS'), { status: 409 });
  }

  if (!phone) throw Object.assign(new Error('PHONE_REQUIRED'), { status: 400 });
  if (!email) throw Object.assign(new Error('EMAIL_REQUIRED'), { status: 400 });

  const newRawPassword = generateRandomPassword(10);
  const passwordHash = await bcrypt.hash(newRawPassword, 10);

  const user = await UserModel.createUser({ phone, email, name, passwordHash, role: 'RESTAURANT_OWNER', avatar });

  await sendWelcomeOwnerEmail(email, name, phone, newRawPassword);

  return {
    user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    message: 'OWNER_ACCOUNT_CREATED_AND_EMAILED'
  };
}


async function login({ identifier, password }) {
  const user = await UserModel.findByPhoneOrEmail({ phone: identifier, email: identifier });
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  // First try bcrypt compare (expected case for hashed passwords)
  let ok = false;
  try {
    if (typeof user.password === 'string' && user.password.length) {
      ok = await bcrypt.compare(password, user.password);
    }
  } catch (e) {
    ok = false;
  }

  // If bcrypt compare fails, allow plaintext match only for ADMIN users
  if (!ok) {
    if (user.role === 'ADMIN' && user.password === password) {
      ok = true;
      console.warn('[auth_service.login] plaintext password accepted for ADMIN user', user.id);
    }
  }

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

  const user = await UserModel.findById(payload.sub);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  const sid = payload.sid; // Keep the same session ID
  const newAccessToken = signAccessToken({ userId: user.id, role: user.role, sid });
  const newRefreshToken = signRefreshToken({ userId: user.id, role: user.role, sid });
  await persistSession({ sid, userId: user.id, role: user.role, refreshToken: newRefreshToken });

  return {
    accessToken: { 
      accessToken: newAccessToken, 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
    },
    refreshToken: { 
      refreshToken: newRefreshToken, 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
    }
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

async function sendOtp({ phone, email }) {
  const identifier = email || phone;
  if (!identifier) throw Object.assign(new Error('IDENTIFIER_REQUIRED'), { status: 400 });

  // Anti-spam / rate limit checks
  const can = await otpUtil.canSendOtp(redis, identifier, { cooldownSeconds: 60, maxPerWindow: 5, windowSeconds: 3600 });
  if (!can.ok) {
    const reason = can.reason === 'TOO_SOON' ? 'OTP_SEND_TOO_SOON' : 'OTP_SEND_RATE_LIMIT_EXCEEDED';
    throw Object.assign(new Error(reason), { status: 429 });
  }

  const code = otpUtil.genOtp();
  // Save OTP in Redis (2 minutes)
  await otpUtil.saveOtp(redis, identifier, code, 120);

  // record this send to enforce limits
  await otpUtil.recordOtpSent(redis, identifier, { cooldownSeconds: 60, windowSeconds: 3600 });

  // Send via Email if provided
  if (email) {
    await sendOtpEmail(email, code);
  } else {
    // If only phone provided, we no longer send SMS from backend as per user request.
    // However, we still save it in Redis in case the frontend sends it via another channel.
    console.warn(`[auth_service.sendOtp] OTP saved for phone ${phone} but no SMS sent from backend.`);
  }

  return { ok: true };
}

async function verifyOtp({ phone, email, code }) {
  const identifier = email || phone;
  if (!identifier) throw Object.assign(new Error('IDENTIFIER_REQUIRED'), { status: 400 });

  const res = await otpUtil.verifyOtp(redis, identifier, code, parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS || '5', 10));
  if (res.ok) return { ok: true };
  if (res.reason === 'EXPIRED') throw Object.assign(new Error('OTP_EXPIRED'), { status: 400 });
  if (res.reason === 'INCORRECT') throw Object.assign(new Error('OTP_INCORRECT'), { status: 400 });
  if (res.reason === 'TOO_MANY_ATTEMPTS') throw Object.assign(new Error('OTP_MAX_ATTEMPTS_EXCEEDED'), { status: 429 });
  throw Object.assign(new Error('OTP_INVALID'), { status: 400 });
}

async function requestPasswordReset({ phone, email }) {
  if (!phone) {
    throw Object.assign(new Error('PHONE_REQUIRED'), { status: 400 });
  }

  // Find user by phone to get their email if not provided
  const user = await UserModel.findByPhoneOrEmail({ phone });
  if (!user) {
    throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });
  }

  const targetEmail = email || user.email;
  if (!targetEmail) {
    throw Object.assign(new Error('EMAIL_NOT_FOUND_FOR_USER'), { status: 400 });
  }

  // If both provided, ensure they match the same record
  if (email && user.email !== email) {
    throw Object.assign(new Error('PHONE_EMAIL_MISMATCH'), { status: 400 });
  }

  // Only CUSTOMER can use public forgot-password flow. 
  // Restaurant Owners and Admin must be reset by Admin or other internal processes.
  if (user.role !== 'CUSTOMER') {
    throw Object.assign(new Error('ROLE_NOT_ALLOWED_FOR_SELF_RESET'), { status: 403 });
  }

  // Anti-spam / rate limit checks
  const can = await otpUtil.canSendOtp(redis, phone, { cooldownSeconds: 60, maxPerWindow: 5, windowSeconds: 3600 });
  if (!can.ok) {
    const reason = can.reason === 'TOO_SOON' ? 'OTP_SEND_TOO_SOON' : 'OTP_SEND_RATE_LIMIT_EXCEEDED';
    throw Object.assign(new Error(reason), { status: 429 });
  }

  const code = otpUtil.genOtp();
  // Store OTP using PHONE as the key in Redis, even though we send to EMAIL
  await otpUtil.saveOtp(redis, phone, code, 120);
  await otpUtil.recordOtpSent(redis, phone, { cooldownSeconds: 60, windowSeconds: 3600 });

  // Send OTP to the user's Email
  await sendOtpEmail(targetEmail, code);

  return { ok: true, message: 'OTP_SENT_TO_EMAIL', email: targetEmail };
}

async function verifyAndResetPassword({ phone, otp }) {
  if (!phone) throw Object.assign(new Error('PHONE_REQUIRED'), { status: 400 });
  await verifyOtp({ phone, code: otp });

  const user = await UserModel.findByPhoneOrEmail({ phone });
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  if (user.role !== 'CUSTOMER') {
    throw Object.assign(new Error('ROLE_NOT_ALLOWED_FOR_SELF_RESET'), { status: 403 });
  }

  const newRawPassword = generateRandomPassword(8);
  const passwordHash = await bcrypt.hash(newRawPassword, 10);

  await UserModel.updatePasswordById(user.id, passwordHash);

  if (user.email) {
    await sendNewPasswordEmail(user.email, newRawPassword);
  }

  return { ok: true, message: 'NEW_PASSWORD_SENT_TO_EMAIL' };
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
    // Allow creating a user from Google sign-in without requiring a phone number.
    // If Firebase provided a phone number or the client supplied one, use it; otherwise save null
    // and allow the user to update phone later from their profile.
    const role = mapAccountTypeToRole(accountType);
    const passwordHash = await bcrypt.hash(uuidv4(), 10);

    // If no phone is provided by Firebase or client, generate a short unique placeholder
    // that satisfies the DB NOT NULL constraint and fits in NVARCHAR(20).
    const placeholderPhone = createPhone || `G${Date.now().toString().slice(-10)}${Math.floor(Math.random()*9000)+1000}`;

    user = await UserModel.createUser({
      phone: placeholderPhone,
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
    accessToken: { 
      accessToken, 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
    },
    refreshToken: { 
      refreshToken, 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
    }
  };
}

function generateRandomPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}


async function changePassword({ userId, oldPassword, newPassword, confirmPassword }) {
  if (!oldPassword || !newPassword || !confirmPassword) {
    throw Object.assign(new Error('MISSING_REQUIRED_FIELDS'), { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    throw Object.assign(new Error('NEW_PASSWORD_CONFIRM_MISMATCH'), { status: 400 });
  }

  const user = await UserModel.findById(userId);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  // Verify old password
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) throw Object.assign(new Error('INVALID_OLD_PASSWORD'), { status: 401 });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await UserModel.updatePasswordById(userId, passwordHash);

  return { success: true, message: 'PASSWORD_CHANGED_SUCCESSFULLY' };
}



async function resetPasswordOwnerByAdmin(id, { newPassword } = {}) {
  const user = await UserModel.findById(id);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  // Nếu Admin không nhập mật khẩu, hệ thống tự sinh ngẫu nhiên
  const passwordToSend = newPassword || generateRandomPassword(10);
  const passwordHash = await bcrypt.hash(passwordToSend, 10);

  await UserModel.updatePasswordById(id, passwordHash);

  if (user.email) {
    await sendNewPasswordEmail(user.email, passwordToSend);
  }

  return { success: true, message: 'OWNER_PASSWORD_RESET_SUCCESSFULLY', email: user.email, hasCustomPassword: !!newPassword };
}

// ====== PARTNER REQUESTS (REDIS) ======
async function submitPartnerRequest({ name, phone, email, documentUrl }) {
  if (!name || !phone || !email || !documentUrl) {
    throw Object.assign(new Error('MISSING_REQUIRED_FIELDS'), { status: 400 });
  }
  
  const id = uuidv4();
  const requestObj = {
    id,
    name,
    phone,
    email,
    documentUrl,
    createdAt: new Date().toISOString()
  };
  
  const key = `partner_request:${id}`;
  // Save hash
  await redis.set(key, JSON.stringify(requestObj), { EX: 30 * 24 * 60 * 60 }); // 30 days
  // Add to list
  await redis.lPush('partner_requests_list', id);
  
  // Notify Admin
  try {
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
    await axios.post(notificationUrl, {
      type: 'web',
      payload: {
        role: 'ADMIN',
        event: 'PARTNER_REQUEST_SUBMITTED',
        message: `New partner request received from ${name} (${phone})`,
        link: '/audit-requests',
        data: requestObj
      }
    });
  } catch (err) {
    console.error('Failed to send notification for partner request:', err.message);
  }
  
  return { success: true, id, message: 'PARTNER_REQUEST_SUBMITTED' };
}

async function getPartnerRequests(query = {}) {
  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || '20', 10);
  const offset = (page - 1) * limit;

  // Lấy các IDs với phân trang
  const ids = await redis.lRange('partner_requests_list', offset, offset + limit - 1);
  const total = await redis.lLen('partner_requests_list');
  
  const data = [];
  for (const id of ids) {
    const raw = await redis.get(`partner_request:${id}`);
    if (raw) {
      try {
        data.push(JSON.parse(raw));
      } catch (e) {}
    } else {
      // Dọn dẹp key bị miss/hết hạn khỏi list. Làm đơn giản thì lách tạm (oops)
      await redis.lRem('partner_requests_list', 0, id);
    }
  }

  return {
    data,
    pagination: {
      page,
      limit,
      total
    }
  };
}

async function getPartnerRequestById(id) {
  const key = `partner_request:${id}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function deletePartnerRequest(id) {
  const key = `partner_request:${id}`;
  await redis.del(key);
  await redis.lRem('partner_requests_list', 0, id);
  return { success: true };
}

// ====== INTERNAL USER MANAGEMENT ======
async function updateUserInternal(userId, data) {
  const user = await UserModel.findById(userId);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  // If email or phone is changing, check for uniqueness
  if (data.email && data.email !== user.email) {
    const existing = await UserModel.findByPhoneOrEmail({ email: data.email });
    if (existing) throw Object.assign(new Error('EMAIL_ALREADY_EXISTS'), { status: 409 });
  }
  if (data.phone && data.phone !== user.phone) {
    const existing = await UserModel.findByPhoneOrEmail({ phone: data.phone });
    if (existing) throw Object.assign(new Error('PHONE_ALREADY_EXISTS'), { status: 409 });
  }

  const updated = await UserModel.updateProfileById(userId, data);
  return updated;
}

async function deleteUserInternal(userId) {
  const user = await UserModel.findById(userId);
  if (!user) throw Object.assign(new Error('USER_NOT_FOUND'), { status: 404 });

  await UserModel.deleteById(userId);
  return { success: true, message: 'USER_HARD_DELETED' };
}

async function checkExists({ email, phone }) {
  const details = {
    email: false,
    phone: false
  };

  if (email) {
    const user = await UserModel.findByPhoneOrEmail({ email });
    if (user && user.email === email) details.email = true;
  }

  if (phone) {
    const user = await UserModel.findByPhoneOrEmail({ phone });
    if (user && user.phone === phone) details.phone = true;
  }

  return {
    exists: details.email || details.phone,
    details
  };
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  sendOtp,
  verifyOtp,
  requestPasswordReset,
  verifyAndResetPassword,
  googleSignIn,
  changePassword,
  createRestaurantOwnerByAdmin,
  resetPasswordOwnerByAdmin,
  submitPartnerRequest,
  getPartnerRequests,
  getPartnerRequestById,
  deletePartnerRequest,
  updateUserInternal,
  deleteUserInternal,
  checkExists
};
