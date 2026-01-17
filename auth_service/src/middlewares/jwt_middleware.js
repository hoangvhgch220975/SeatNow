const jwt = require('jsonwebtoken');

exports.requireAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role, sid: payload.sid };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
