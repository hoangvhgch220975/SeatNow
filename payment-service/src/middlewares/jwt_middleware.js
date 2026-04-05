const jwt = require('jsonwebtoken');

module.exports = {
  requireAuth: function (req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing access token' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        audience: 'seatnow-client',
        issuer: 'seatnow-auth-service'
      });
      req.user = {
        id: payload.sub || payload.userId || payload.id,
        role: payload.role
      };
      next();
    } catch (e) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }
};
