const Review = require('../models/review.mongo');

async function createReview(data) {
  return Review.create(data);
}

module.exports = { createReview };
