/**
 * review.controller (placeholder)
 */
const reviewSvc = require('../services/review_service');

// Hàm liệt kê đánh giá của một nhà hàng với phân trang
async function list(req, res) {
  try {
    const restaurantId = await require('../services/restaurant_service').resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });
    
    const { reviews, total } = await reviewSvc.listReviews(restaurantId, req.query);
    res.json({ 
      data: reviews, 
      total, 
      meta: { 
        limit: parseInt(req.query.limit || 20, 10), 
        offset: parseInt(req.query.offset || 0, 10) 
      } 
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo đánh giá mới cho một nhà hàng
async function create(req, res) {
  try {
    const customerId = req.user?.userId || req.user?.id || null;
    const data = await reviewSvc.createReview(req.params.id, customerId, req.body);
    res.status(201).json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Lấy tóm tắt chi tiết (số lượng sao) cho nhà hàng
async function getSummary(req, res) {
  try {
    const restaurantId = await require('../services/restaurant_service').resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const data = await reviewSvc.getReviewSummary(restaurantId);
    res.json(data);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

module.exports = { list, create, getSummary };
