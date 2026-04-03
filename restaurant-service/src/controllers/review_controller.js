/**
 * review.controller (placeholder)
 */
const reviewSvc = require('../services/review_service');

// Hàm liệt kê đánh giá của một nhà hàng với phân trang
async function list(req, res) {
  try {
    const data = await reviewSvc.listReviews(req.params.id, req.query);
    res.json({ data, meta: { limit: req.query.limit, offset: req.query.offset } });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo đánh giá mới cho một nhà hàng
async function create(req, res) {
  try {
    const customerId = req.user?.userId || req.user?.id;
    const data = await reviewSvc.createReview(req.params.id, customerId, req.body);
    res.status(201).json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Lấy tóm tắt chi tiết (số lượng sao) cho nhà hàng
async function getSummary(req, res) {
  try {
    const data = await reviewSvc.getReviewSummary(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

module.exports = { list, create, getSummary };

