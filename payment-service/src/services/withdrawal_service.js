// withdrawal_service.js
const paymentModel = require('../models/payment_sql');
const { getRedis } = require('../config/redis');
const { generateReferenceCode } = require('../utils/reference-code');
const { normalizeAmount } = require('../utils/money');
const axios = require('axios');

async function createWithdrawal({ idOrSlug, amount, description, withdrawMethod, bankInfo, qrCodeUrl }) {
  // 1. Resolve restaurantId from slug/id
  let restaurantId = idOrSlug;
  let restaurantName = idOrSlug;
  const restaurantBaseUrl = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3003/api/v1';

  try {
    const resResp = await axios.get(`${restaurantBaseUrl}/restaurants/${idOrSlug}`);
    const resData = resResp.data?.data || resResp.data;
    if (resData && resData.id) {
      restaurantId = resData.id;
      restaurantName = resData.name || restaurantId;
    }
  } catch (err) {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);
    if (!isUuid) {
      const e = new Error('Restaurant not found or invalid id/slug');
      e.status = 404;
      throw e;
    }
  }

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

    // Prepare metadata for bank or QR
    const metadataJson = {
      withdrawMethod: withdrawMethod || 'BANK_TRANSFER',
      bankInfo: bankInfo || null,
      qrCodeUrl: qrCodeUrl || null
    };

    // Map withdraw method to payment provider
    const mappedPaymentMethod = withdrawMethod === 'QR' ? 'MOMO' : 'VNPAY';

    const withdrawal = await paymentModel.createWithdrawalRequest({
      restaurantId,
      amount: normalizedAmount,
      description,
      referenceCode,
      idempotencyKey: referenceCode,
      metadataJson,
      paymentMethod: mappedPaymentMethod
    });

    // Notify Admin via notification service
    try {
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      await axios.post(notificationUrl, {
        type: 'web',
        payload: {
          role: 'ADMIN',
          event: 'WITHDRAWAL_REQUESTED',
          title: 'Withdrawal Requested',
          message: `Restaurant ${restaurantName} requested withdrawal of ${normalizedAmount} VND`,
          link: '/audit-requests',
          data: {
            restaurantId,
            restaurantName,
            referenceCode,
            amount: normalizedAmount,
            description,
            metadata: metadataJson
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
      await axios.post(notifUrl, {
        type: 'web',
        payload: {
          walletId: tx.walletId,
          restaurantId: tx.restaurantId,
          event: 'TRANSACTION_WITHDRAW_APPROVED',
          title: 'Withdrawal Approved',
          message: `Withdrawal approved: ${Number(tx.amount || 0).toLocaleString('vi-VN')} VND`,
          link: `/restaurant/wallet/transactions/${transactionId}`,
          data: { 
            transactionId, 
            restaurantId: tx.restaurantId,
            amount: tx.amount, 
            referenceCode: tx.referenceCode 
          }
        }
      });
    }
  } catch (notifErr) {
    console.error('[Withdrawal] Notification error:', notifErr.message);
  }

  return result;
}

async function rejectWithdrawal({ transactionId, reason }) {
  const result = await paymentModel.rejectWithdrawalRequest(transactionId, { reason });

  // Notify restaurant owner: withdrawal rejected
  try {
    const tx = await paymentModel.findTransactionById(transactionId);
    if (tx && tx.walletId) {
      const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      await axios.post(notifUrl, {
        type: 'web',
        payload: {
          walletId: tx.walletId,
          restaurantId: tx.restaurantId,
          event: 'TRANSACTION_WITHDRAW_REJECTED',
          title: 'Withdrawal Rejected',
          message: `Withdrawal rejected: ${reason || 'Contact support for details'}`,
          link: `/restaurant/wallet/transactions/${transactionId}`,
          data: { 
            transactionId, 
            restaurantId: tx.restaurantId,
            reason, 
            referenceCode: tx.referenceCode 
          }
        }
      });
    }
  } catch (notifErr) {
    console.error('[Withdrawal] Rejection notification error:', notifErr.message);
  }

  return result;
}

module.exports = {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal
};
