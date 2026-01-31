/**
 * review.service (placeholder)
 */
const Review = require('../models/review_mongo');

// Hàm liệt kê đánh giá của một nhà hàng với các tùy chọn phân trang
async function listReviews(restaurantId, { limit = 20, offset = 0 } = {}) {
  return Review.find({ restaurantId })
    .sort({ createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();
}

// Hàm tạo một đánh giá mới cho nhà hàng
async function createReview(restaurantId, customerId, payload) {
  const doc = await Review.create({
    ...payload,
    restaurantId,
    customerId,
    isVerified: true
  });
  return doc.toObject();
}

module.exports = { listReviews, createReview };
