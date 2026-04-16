/**
 * Mongoose model: Review (placeholder)
 */
// review.mongo.js
const { mongoose } = require('../config/mongo');

const schema = new mongoose.Schema({
  bookingId: { type: String, required: false, index: true },
  customerId: { type: String, required: false },
  restaurantId: { type: String, required: true, index: true },

  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  images: [{ type: String }],

  foodRating: { type: Number, min: 1, max: 5 },
  serviceRating: { type: Number, min: 1, max: 5 },
  atmosphereRating: { type: Number, min: 1, max: 5 },

  isVerified: { type: Boolean, default: true },
  helpful: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});
schema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (typeof next === 'function') return next();
});

module.exports = mongoose.model('Review', schema);
