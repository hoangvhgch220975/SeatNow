const jwt = require('jsonwebtoken');

function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub || payload.userId || payload.id, role: payload.role };
  } catch {}
  return next();
}

module.exports = optionalAuth;
