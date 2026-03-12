// validate.middleware.js
// Purpose: run Joi/Zod schema validation for request payloads and query params.
// Usage: validate(schema) -> middleware

module.exports = function validate(schema) {
  return (req, res, next) => {
    if (!schema) return next();
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(422).json({ message: error.message });
    req.body = value;
    next();
  };
};
