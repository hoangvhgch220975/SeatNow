/**
 * review.service (placeholder)
 */
const Review = require('../models/review_mongo');
const restaurantSql = require('../models/restaurant_sql');

// Hàm liệt kê đánh giá của một nhà hàng với các tùy chọn phân trang
async function listReviews(restaurantId, { limit = 20, offset = 0 } = {}) {
  return Review.find({ restaurantId })
    .sort({ createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();
}

// Cập nhật lại Rating trung bình sau khi review
async function aggregateRestaurantRating(restaurantId) {
  const stats = await Review.aggregate([
    { $match: { restaurantId: String(restaurantId) } },
    { $group: { 
        _id: '$restaurantId', 
        count: { $sum: 1 }, 
        avg: { $avg: '$rating' } 
      } 
    }
  ]);
  
  if (stats.length > 0) {
    const { count, avg } = stats[0];
    const roundedAvg = Math.round(avg * 10) / 10; // làm tròn 1 chữ số thập phân
    await restaurantSql.updateRestaurantRating(restaurantId, roundedAvg, count);
  } else {
    // Nếu không có review nào
    await restaurantSql.updateRestaurantRating(restaurantId, 0, 0);
  }
}

// Hàm tạo một đánh giá mới cho nhà hàng
async function createReview(restaurantId, customerId, payload) {
  const doc = await Review.create({
    ...payload,
    restaurantId,
    customerId,
    isVerified: true
  });
  
  // Tiến hành tính toán và lưu rating lên SQL Server đồng bộ
  await aggregateRestaurantRating(restaurantId);

  return doc.toObject();
}

module.exports = { listReviews, createReview, aggregateRestaurantRating };
