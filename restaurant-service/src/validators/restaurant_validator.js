/**
 * restaurant.validator
 */
const Joi = require('joi');
const { CUISINE_TYPES } = require('../constants/cuisine_types');

// Schema tạo nhà hàng - chỉ ADMIN dùng
// Admin tạo thay owner, điền đầy đủ chính sách từ yêu cầu của nhà hàng
const createRestaurantSchema = Joi.object({
  ownerId: Joi.string().uuid().optional(),  // Admin có thể truyền, Owner thì tự lấy từ token
  name: Joi.string().min(2).max(150).required(),
  address: Joi.string().min(3).max(255).required(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  phone: Joi.string().max(20).required(),
  email: Joi.string().email().allow(null, ''),
  cuisineTypes: Joi.array().items(Joi.string().valid(...CUISINE_TYPES)).default([]),
  priceRange: Joi.number().integer().min(1).max(4).required(),
  description: Joi.string().allow('', null),
  images: Joi.array().items(Joi.string().max(2048)).default([]),
  openingHours: Joi.object().unknown(true).default({}),
  // Admin-only fields
  status: Joi.string().valid('pending', 'active', 'suspended').default('pending'),
  commissionRate: Joi.number().min(0).max(100).default(10),
  isPremium: Joi.boolean().default(false),
  depositEnabled: Joi.boolean().default(false),
  depositPolicy: Joi.object().unknown(true).allow(null)
});

// Schema cập nhật nhà hàng - ADMIN + RESTAURANT_OWNER dùng
// Các trường nhạy cảm (status, commissionRate, isPremium) chỉ admin thay đổi được (controller sẽ strip)
const updateRestaurantSchema = Joi.object({
  name: Joi.string().min(2).max(150),
  slug: Joi.string().min(2).max(200),
  address: Joi.string().min(3).max(255),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  phone: Joi.string().max(20),
  email: Joi.string().email().allow(null, ''),
  cuisineTypes: Joi.array().items(Joi.string().valid(...CUISINE_TYPES)),
  priceRange: Joi.number().integer().min(1).max(4),
  description: Joi.string().allow('', null),
  images: Joi.array().items(Joi.string().max(2048)),
  openingHours: Joi.object().unknown(true),
  // Admin-only (bị strip trong controller nếu không phải ADMIN)
  status: Joi.string().valid('pending', 'active', 'suspended'),
  commissionRate: Joi.number().min(0).max(100),
  isPremium: Joi.boolean()
});

// Schema kiểm tra chính sách đặt cọc
const depositPolicySchema = Joi.object({
  depositEnabled: Joi.boolean().required(),
  depositPolicy: Joi.object().unknown(true).allow(null)
});

module.exports = { createRestaurantSchema, updateRestaurantSchema, depositPolicySchema };
