/**
 * Common validators (placeholder)
 */
const Joi = require('joi');

// Kiểm tra tham số truy vấn cho danh sách nhà hàng
const listQuerySchema = Joi.object({
  q: Joi.string().allow('').max(200),
  cuisine: Joi.string().max(100),
  priceRange: Joi.number().integer().min(1).max(4),
  status: Joi.string().valid('pending', 'active', 'suspended', 'all').default('active'),

  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  radiusKm: Joi.number().min(0.5).max(50).default(5),
  sort: Joi.string().valid('distance', 'rating', 'newest').default('distance'),

  limit: Joi.number().integer().min(1).max(50).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

// Middleware kiểm tra và chuẩn hóa tham số truy vấn
function validateQuery(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.query, { abortEarly: false, convert: true });
    if (error) return res.status(400).json({ message: 'Invalid query', details: error.details.map(d => d.message) });
    req.query = value;
    next();
  };
}

// Middleware kiểm tra và chuẩn hóa payload body
function validateBody(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body, { abortEarly: false, convert: true });
    if (error) return res.status(400).json({ message: 'Invalid payload', details: error.details.map(d => d.message) });
    req.body = value;
    next();
  };
}

module.exports = { listQuerySchema, validateQuery, validateBody };
