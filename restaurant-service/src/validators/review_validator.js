/**
 * review.validator
 */
const Joi = require('joi');

// Schema kiểm tra dữ liệu khi tạo đánh giá nhà hàng
const createReviewSchema = Joi.object({
  bookingId: Joi.string().optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
  images: Joi.array().items(Joi.string().max(2048)).default([]),

  foodRating: Joi.number().integer().min(1).max(5).allow(null),
  serviceRating: Joi.number().integer().min(1).max(5).allow(null),
  atmosphereRating: Joi.number().integer().min(1).max(5).allow(null)
});

module.exports = { createReviewSchema };
