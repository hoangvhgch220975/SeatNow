// withdrawal_service.js
const paymentModel = require('../models/payment_sql');
const { getRedis } = require('../config/redis');
const { generateReferenceCode } = require('../utils/reference-code');
const { normalizeAmount } = require('../utils/money');
const axios = require('axios');

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

    const withdrawal = await paymentModel.createWithdrawalRequest({
      restaurantId,
      amount: normalizedAmount,
      description,
      referenceCode,
      idempotencyKey: referenceCode
    });

    // Notify Admin via notification service
    try {
      let restaurantName = restaurantId;
      try {
        const restaurantBaseUrl = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3003/api/v1';
        const resResp = await axios.get(`${restaurantBaseUrl}/restaurants/${restaurantId}`);
        restaurantName = resResp.data?.data?.name || resResp.data?.name || resResp.data?.restaurant?.name || restaurantId;
      } catch(ignoreErr) {
        // Fallback to ID if fetch fails
      }

      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      await axios.post(`${notificationUrl}/test`, {
        type: 'web',
        payload: {
          role: 'ADMIN',
          event: 'withdrawal_requested',
          message: `Restaurant ${restaurantName} requested withdrawal of ${normalizedAmount} VND`,
          data: {
            restaurantId,
            restaurantName,
            referenceCode,
            amount: normalizedAmount,
            description
          }
        }
      });
    } catch (notifErr) {
      console.error('Failed to notify admin of new withdrawal:', notifErr.message);
    }

    return withdrawal;
  } finally {
    await redis.del(lockKey);
  }
}

async function approveWithdrawal({ transactionId, providerTxnId, metadataJson }) {
  const result = await paymentModel.approveWithdrawalRequest(transactionId, { providerTxnId, metadataJson });

  // Notify restaurant owner: withdrawal approved
  try {
    const tx = await paymentModel.findTransactionById(transactionId);
    if (tx && tx.walletId) {
      const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      fetch(`${notifUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          payload: {
            walletId: tx.walletId,
            event: 'TRANSACTION_WITHDRAW_APPROVED',
            message: `Withdrawal approved: ${Number(tx.amount || 0).toLocaleString('vi-VN')} VND`,
            data: { transactionId, amount: tx.amount, referenceCode: tx.referenceCode }
          }
        })
      }).catch(err => console.error('[Withdrawal] Failed to notify owner:', err.message));
    }
  } catch (notifErr) {
    console.error('[Withdrawal] Notification error:', notifErr.message);
  }

  return result;
}

async function rejectWithdrawal({ transactionId, reason }) {
  return paymentModel.rejectWithdrawalRequest(transactionId, { reason });
}

module.exports = {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal
};
