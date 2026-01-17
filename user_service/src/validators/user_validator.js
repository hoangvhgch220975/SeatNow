const Joi = require('joi');

const updateMeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  avatar: Joi.string().trim().max(1024).allow(null, '').optional()
}).min(1);

function validateUpdateMe(body) {
  return updateMeSchema.validate(body, { abortEarly: false, stripUnknown: true });
}

module.exports = { validateUpdateMe };
