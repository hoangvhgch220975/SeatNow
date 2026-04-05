const jwt = require('jsonwebtoken');
const adminModel = require('../models/admin_sql');

function extractUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  if (!process.env.JWT_ACCESS_SECRET) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET || '', {
      audience: 'seatnow-client',
      issuer: 'seatnow-auth-service'
    });
    return {
      id: payload.sub || payload.userId || payload.id,
      role: payload.role
    };
  } catch (_err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const dbUser = await adminModel.getUserAuthById(user.id);
    if (!dbUser || dbUser.isDeleted) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      email: dbUser.email,
      fullName: dbUser.fullName
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };