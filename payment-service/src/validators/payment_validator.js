// payment.validator.js
// Validate payload cho cac API payment/wallet.

const Joi = require('joi');

const createWalletTopupSchema = Joi.object({
  restaurantId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
  provider: Joi.string().valid('MOMO', 'VNPAY').required(),
  amount: Joi.number().positive().required()
});

const chargeCommissionSchema = Joi.object({
  restaurantId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
  adminUserId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().allow('', null).max(1000).optional()
});

module.exports = {
  createWalletTopupSchema,
  chargeCommissionSchema
};
