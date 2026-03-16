module.exports = function internalAuth(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected) {
    return res.status(500).json({ success: false, message: 'INTERNAL_SERVICE_TOKEN is not configured' });
  }

  const got = req.headers['x-internal-token'];
  if (!got || got !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized internal request' });
  }

  next();
};