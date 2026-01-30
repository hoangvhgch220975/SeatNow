/**
 * review.controller (placeholder)
 */
const reviewService = require('../services/review.service');

async function createReview(req, res, next) {
  try {
    const payload = req.body;
    const review = await reviewService.createReview(payload);
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}

module.exports = { createReview };
