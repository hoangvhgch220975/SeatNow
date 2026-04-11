/**
 * menu.validator
 */
const Joi = require('joi');

// Schema cơ sở chứa tất cả các trường có thể có của một món ăn
const baseMenuItemSchema = {
  name: Joi.string().min(1).max(200),
  description: Joi.string().allow('', null),
  price: Joi.number().min(0),
  discountPrice: Joi.number().min(0).allow(null),
  category: Joi.string().max(100).allow('', null),
  images: Joi.array().items(Joi.string().max(2048)).default([]),
  isAvailable: Joi.boolean().default(true),
  preparationTime: Joi.number().min(0).allow(null),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  allergens: Joi.array().items(Joi.string().max(50)).default([])
};

// Schema dùng cho việc tạo mới (Bắt buộc name và price)
const createMenuItemSchema = Joi.object({
  ...baseMenuItemSchema,
  name: baseMenuItemSchema.name.required(),
  price: baseMenuItemSchema.price.required()
});

// Schema dùng cho việc cập nhật (Tất cả đều tùy chọn để hỗ trợ partial update)
const updateMenuItemSchema = Joi.object({
  ...baseMenuItemSchema
});

module.exports = { createMenuItemSchema, updateMenuItemSchema };

