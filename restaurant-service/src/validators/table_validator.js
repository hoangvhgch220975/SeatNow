const Joi = require('joi');

const createTableSchema = Joi.object({
  // DB stores tableNumber as NVARCHAR(50) so accept string identifiers like "A1", "T-01"
  tableNumber: Joi.string().max(50).required(),
  capacity: Joi.number().integer().min(1).required(),
  type: Joi.string().valid('standard', 'vip', 'outdoor').default('standard'),
  location: Joi.string().valid('1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', 'Rooftop', 'Terrace', 'Outdoor'),
  status: Joi.string().valid('available', 'unavailable', 'maintenance').default('available')
});

const updateTableSchema = Joi.object({
  tableNumber: Joi.string().max(50),
  capacity: Joi.number().integer().min(1),
  type: Joi.string().valid('standard', 'vip', 'outdoor'),
  location: Joi.string().valid('1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', 'Rooftop', 'Terrace', 'Outdoor'),
  status: Joi.string().valid('available', 'unavailable', 'maintenance')
}).min(1);

module.exports = { createTableSchema, updateTableSchema };
