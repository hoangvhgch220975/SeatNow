/**
 * Rate limit middleware placeholder
 * Implement real rate limiting (express-rate-limit / redis) when required.
 */
module.exports = function rateLimitMiddleware(req, res, next) {
  next();
};
