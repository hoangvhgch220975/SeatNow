module.exports = function jwtMiddleware(req, res, next) {
  // TODO: verify JWT from Authorization header
  next();
};
