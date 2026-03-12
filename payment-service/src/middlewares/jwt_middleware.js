// jwt.middleware.js
// Purpose: extract and verify JWT from Authorization header and
// attach `req.user` with `{ id, role, ... }` to downstream handlers.
// Implementation note: reuse project's auth-service public key or secret.

module.exports = {
  requireAuth: function (req, res, next) {
    // placeholder implementation
    if (req.headers.authorization) {
      // parse token, verify and attach req.user
      req.user = { id: 'placeholder', role: 'CUSTOMER' };
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
