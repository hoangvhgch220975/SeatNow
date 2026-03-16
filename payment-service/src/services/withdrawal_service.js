// withdrawal_service.js
const paymentModel = require('../models/payment_sql');
const { getRedis } = require('../config/redis');
const { generateReferenceCode } = require('../utils/reference-code');
const { normalizeAmount } = require('../utils/money');

async function createWithdrawal({ restaurantId, amount, description }) {
  const redis = await getRedis();
  const lockKey = `payment:withdrawal:create:${restaurantId}`;
  const locked = await redis.set(lockKey, '1', { NX: true, EX: 30 });

  if (!locked) {
    const e = new Error('Withdrawal request is being processed');
    e.status = 409;
    throw e;
  }

  try {
    const referenceCode = generateReferenceCode('WDL');
    const normalizedAmount = normalizeAmount(amount);

    return paymentModel.createWithdrawalRequest({
      restaurantId,
      amount: normalizedAmount,
      description,
      referenceCode,
      idempotencyKey: referenceCode
    });
  } finally {
    await redis.del(lockKey);
  }
}

async function approveWithdrawal({ transactionId, providerTxnId, metadataJson }) {
  return paymentModel.approveWithdrawalRequest(transactionId, { providerTxnId, metadataJson });
}

async function rejectWithdrawal({ transactionId, reason }) {
  return paymentModel.rejectWithdrawalRequest(transactionId, { reason });
}

module.exports = {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal
};
