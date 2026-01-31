/**
 * menu.validator (placeholder)
 */
const Joi = require('joi');

// Schema kiểm tra dữ liệu khi tạo hoặc cập nhật menu item
const upsertMenuItemSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().allow('', null),
  price: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).allow(null),
  category: Joi.string().max(100).allow('', null),
  images: Joi.array().items(Joi.string().max(2048)).default([]),
  isAvailable: Joi.boolean().default(true),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  allergens: Joi.array().items(Joi.string().max(50)).default([])
});

module.exports = { upsertMenuItemSchema };

