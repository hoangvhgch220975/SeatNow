/**
 * auth.middleware.js - Middleware xác thực JWT cho notification-service
 */
const jwt = require('jsonwebtoken');

/**
 * Middleware bắt buộc xác thực JWT
 * Gắn thông tin user vào req.user nếu token hợp lệ
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // Hỗ trợ nhiều trường id: sub, userId, id
    req.user = {
      id: payload.sub || payload.userId || payload.id,
      role: payload.role
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

/**
 * Middleware yêu cầu quyền Owner hoặc Admin
 */
function requireOwnerOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthenticated.' });
  if (req.user.role !== 'RESTAURANT_OWNER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied. Owner or Admin role required.' });
  }
  next();
}

/**
 * Middleware yêu cầu một role cụ thể
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated.' });
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Access denied. ${role} role required.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireOwnerOrAdmin, requireRole };
