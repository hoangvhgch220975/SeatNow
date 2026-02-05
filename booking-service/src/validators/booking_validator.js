const Joi = require('joi');

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv1', 'uuidv5'] });

const createBookingSchema = Joi.object({
// booking fields
  restaurantId: uuid.required(),
  tableId: uuid.optional().allow(null),
  bookingDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  bookingTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  numGuests: Joi.number().integer().min(1).max(50).required(),
  specialRequests: Joi.string().max(2000).optional().allow('', null),

  // guest fields (nếu không đăng nhập)
  guestName: Joi.string().max(100).optional().allow('', null),
  guestPhone: Joi.string().max(20).optional().allow('', null),
  guestEmail: Joi.string().email().max(255).optional().allow('', null)
});

module.exports = { createBookingSchema };
