// payment.validator.js
// Validate payload cho cac API payment/wallet.

const Joi = require('joi');

const createWalletTopupSchema = Joi.object({
  // Chấp nhận UUID hoặc slug (resolve được xử lý tại service layer)
  restaurantId: Joi.string().min(1).max(255).required(),
  provider: Joi.string().valid('MOMO', 'VNPAY').required(),
  amount: Joi.number().positive().required()
});

const chargeCommissionSchema = Joi.object({
  restaurantId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
  adminUserId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().allow('', null).max(1000).optional(),
  idempotencyKey: Joi.string().trim().max(100).optional()
});

const createWithdrawalSchema = Joi.object({
  idOrSlug: Joi.string().min(1).max(255).required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().allow('', null).max(1000).optional(),
  withdrawMethod: Joi.string().valid('CARD', 'QR').required(),
  bankInfo: Joi.object({
    bankName: Joi.string().allow('', null).optional(),
    cardNumber: Joi.string().allow('', null).optional(),
    accountName: Joi.string().allow('', null).optional(),
    expiryDate: Joi.string().allow('', null).optional(),
    cvv: Joi.string().allow('', null).optional()
  }).optional(),
  qrCodeUrl: Joi.string().uri().allow('', null).optional()
});

module.exports = {
  createWalletTopupSchema,
  chargeCommissionSchema,
  createWithdrawalSchema
};
