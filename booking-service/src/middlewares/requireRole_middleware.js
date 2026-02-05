/**
 * requireRole middleware placeholder
 * Usage: requireRole('RESTAURANT_OWNER')
 */
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!req.user?.role) return res.status(401).json({ message: 'Missing role' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};
