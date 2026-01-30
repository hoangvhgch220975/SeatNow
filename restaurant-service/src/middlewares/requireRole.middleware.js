module.exports = function requireRole(role) {
  return (req, res, next) => {
    // TODO: check req.user.role
    next();
  };
};
