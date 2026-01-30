/**
 * requireRole middleware placeholder
 * Usage: requireRole('RESTAURANT_OWNER')
 */
module.exports = function requireRole(role) {
  return (req, res, next) => {
    // noop placeholder: real implementation should check req.user.role
    next();
  };
};
