/**
 * Mongoose model: MenuItem (placeholder)
 */

// menuItem.mongo.js
const { mongoose } = require('../config/mongo');

const schema = new mongoose.Schema({
  restaurantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  category: { type: String },
  images: [{ type: String }],
  isAvailable: { type: Boolean, default: true },
  preparationTime: { type: Number },
  tags: [{ type: String }],
  allergens: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

schema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (typeof next === 'function') return next();
});

module.exports = mongoose.model('MenuItem', schema);

