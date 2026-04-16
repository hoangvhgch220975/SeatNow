/**
 * JWT middleware placeholder
 * Provides two named middlewares: `requireAuth` and `authOptional`.
 * Replace with real JWT verification (e.g., jsonwebtoken) when needed.
 */
const jwt = require('jsonwebtoken');

function _extractUserFromHeaders(req) {
  const uid = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  if (uid && role) return { id: String(uid), role: String(role) };
  const auth = req.headers.authorization || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (token) {
    // Clean token from common copy-paste errors (quotes)
    token = token.trim().replace(/^["']+|["']+$/g, '');
  }
  
  if (!token) return null;
  try {
    const p = jwt.verify(token, process.env.JWT_ACCESS_SECRET || '', {
      audience: 'seatnow-client',
      issuer: 'seatnow-auth-service'
    });
    return { id: p.sub || p.userId || p.id, role: p.role };
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = _extractUserFromHeaders(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  req.user = user;
  next();
}

function authOptional(req, res, next) {
  const user = _extractUserFromHeaders(req);
  if (user) req.user = user;
  next();
}

module.exports = { requireAuth, authOptional };
