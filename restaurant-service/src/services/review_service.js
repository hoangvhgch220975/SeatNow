/**
 * review.service (placeholder)
 */
const Review = require('../models/review_mongo');

async function createReview(data) {
  return Review.create(data);
}

module.exports = { createReview };
