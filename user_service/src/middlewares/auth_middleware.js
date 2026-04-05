const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing access token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      audience: 'seatnow-client',
      issuer: 'seatnow-auth-service'
    });
    // auth-service nên sign payload kiểu: { sub: userId, role, ... }
    req.user = {
      id: payload.sub || payload.userId || payload.id,
      role: payload.role
    };
    if (!req.user.id) return res.status(401).json({ message: 'Invalid token payload' });
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid/expired token' });
  }
}

module.exports = { requireAuth };
