const Joi = require('joi');

const createTableSchema = Joi.object({
  tableNumber: Joi.number().integer().min(1).required(),
  capacity: Joi.number().integer().min(1).required(),
  type: Joi.string().max(50).default('standard'),      
  location: Joi.string().max(255).allow(null, ''),     
  status: Joi.string().valid('active', 'inactive', 'reserved').default('active')
});

const updateTableSchema = Joi.object({
  tableNumber: Joi.number().integer().min(1),
  capacity: Joi.number().integer().min(1),
  type: Joi.string().max(50),
  location: Joi.string().max(255).allow(null, ''),
  status: Joi.string().valid('active', 'inactive', 'reserved')
}).min(1);

module.exports = { createTableSchema, updateTableSchema };
