/**
 * review.service (placeholder)
 */
const Review = require('../models/review_mongo');
const restaurantSql = require('../models/restaurant_sql');
const userSql = require('../models/user_sql'); // Thêm model lấy thông tin user

// Ảnh đại diện mặc định cho Khách vãng lai hoặc User chưa có ảnh
const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=Guest&background=random';

// Hàm liệt kê đánh giá của một nhà hàng với các tùy chọn phân trang và bổ sung thông tin User
async function listReviews(restaurantId, { limit = 20, offset = 0 } = {}) {
  // 1. Lấy danh sách đánh giá từ MongoDB và tổng số lượng
  const [reviews, total] = await Promise.all([
    Review.find({ restaurantId })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean(),
    Review.countDocuments({ restaurantId })
  ]);

  if (!reviews.length) return { reviews: [], total };

  // 2. Thu thập danh sách customerId duy nhất
  const customerIds = [...new Set(reviews.map(r => r.customerId).filter(id => id))];

  // 3. Lấy thông tin chi tiết (tên, avatar) từ SQL Server
  const users = await userSql.findUsersByIds(customerIds);
  const userMap = users.reduce((map, u) => {
    map[u.id.toLowerCase()] = u;
    return map;
  }, {});

  // 4. Gắn thông tin người dùng vào từng đánh giá
  const rows = reviews.map(review => {
    const userId = review.customerId?.toLowerCase();
    const userInfo = userId ? userMap[userId] : null;

    return {
      ...review,
      customerName: userInfo?.name || 'Khách vãng lai',
      customerAvatar: userInfo?.avatar || DEFAULT_AVATAR
    };
  });

  return { reviews: rows, total };
}

// Cập nhật lại Rating trung bình sau khi có đánh giá mới
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
    // Nếu không có đánh giá nào
    await restaurantSql.updateRestaurantRating(restaurantId, 0, 0);
  }
}

// Lấy tóm tắt chi tiết các mức đánh giá (5, 4, 3, 2, 1 sao)
async function getReviewSummary(restaurantId) {
  const result = await Review.aggregate([
    { $match: { restaurantId: String(restaurantId) } },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  // Định dạng lại thành object cho frontend dễ sử dụng
  const summary = {
    totalReviews: 0,
    averageRating: 0,
    ratingBreakdown: {
      "5_star": 0,
      "4_star": 0,
      "3_star": 0,
      "2_star": 0,
      "1_star": 0
    }
  };

  let totalPoints = 0;
  result.forEach(item => {
    const starKey = `${item._id}_star`;
    summary.ratingBreakdown[starKey] = item.count;
    summary.totalReviews += item.count;
    totalPoints += (item._id * item.count);
  });

  if (summary.totalReviews > 0) {
    summary.averageRating = Math.round((totalPoints / summary.totalReviews) * 10) / 10;
  }

  return summary;
}

// Hàm tạo một đánh giá mới cho nhà hàng
async function createReview(restaurantId, customerId, payload) {
  // Nếu có bookingId, kiểm tra tính hợp lệ của đơn đặt chỗ
  if (payload.bookingId) {
    const { getBookingStatus } = require('../models/booking_sql');
    const booking = await getBookingStatus(payload.bookingId);
    
    if (!booking) {
      throw new Error('BOOKING_NOT_FOUND');
    }
    
    if (booking.status !== 'COMPLETED') {
      throw new Error('ONLY_COMPLETED_BOOKINGS_CAN_BE_REVIEWED');
    }
  }

  const doc = await Review.create({
    ...payload,
    restaurantId,
    customerId,
    isVerified: !!payload.bookingId
  });
  
  // Tính toán lại rating trung bình và cập nhật SQL Server
  await aggregateRestaurantRating(restaurantId);

  // Notify restaurant owner: new review received
  try {
    const restaurant = await restaurantSql.findById(restaurantId);
    if (restaurant && restaurant.ownerId) {
      const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      fetch(notifUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          payload: {
            userId: restaurant.ownerId,
            restaurantId,
            event: 'REVIEW_NEW',
            title: 'New Review Received',
            message: `New ${payload.rating}-star review for ${restaurant.name}`,
            link: '/restaurant/reviews',
            data: {
              restaurantId,
              restaurantName: restaurant.name,
              rating: payload.rating,
              comment: payload.comment
            }
          }
        })
      }).catch(err => console.error('[Review] Failed to notify owner:', err.message));
    }
  } catch (notifErr) {
    console.error('[Review] Notification error:', notifErr.message);
  }

  return doc.toObject();
}

module.exports = { listReviews, createReview, aggregateRestaurantRating, getReviewSummary };
