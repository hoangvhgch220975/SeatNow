/**
 * restaurant.validator (placeholder)
 */
const Joi = require('joi');

// Schema kiểm tra dữ liệu khi tạo hoặc cập nhật nhà hàng
const upsertRestaurantSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  address: Joi.string().min(3).max(255).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  phone: Joi.string().max(20).required(),
  email: Joi.string().email().allow(null, ''),
  cuisineTypes: Joi.array().items(Joi.string().max(100)).default([]),
  priceRange: Joi.number().integer().min(1).max(4).required(),
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
