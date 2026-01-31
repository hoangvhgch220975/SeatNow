/**
 * restaurant.validator (placeholder)
 */
const Joi = require('joi');

// Schema kiểm tra dữ liệu khi tạo hoặc cập nhật nhà hàng
const upsertRestaurantSchema = Joi.object({
  name: Joi.string().min(2).max(150),
  address: Joi.string().min(3).max(255),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  phone: Joi.string().max(20),
  email: Joi.string().email().allow(null, ''),
  cuisineTypes: Joi.array().items(Joi.string().max(100)).default([]),
  priceRange: Joi.number().integer().min(1).max(4).required(),
  status: Joi.string().valid('pending', 'active', 'suspended'),
  description: Joi.string().allow('', null),
  images: Joi.array().items(Joi.string().max(2048)).default([]),
  openingHours: Joi.object().unknown(true).default({})
});

// Schema kiểm tra chính sách đặt cọc
const depositPolicySchema = Joi.object({
  depositEnabled: Joi.boolean().required(),
  depositPolicy: Joi.object().unknown(true).allow(null)
});


module.exports = { upsertRestaurantSchema, depositPolicySchema };
