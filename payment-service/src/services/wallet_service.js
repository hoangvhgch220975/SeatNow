// wallet.service.js
// Xu ly nghiep vu vi: top-up, xem so du, lich su va thu commission.

const paymentModel = require('../models/payment_sql');
const { getRedis } = require('../config/redis');
const { generateReferenceCode } = require('../utils/reference-code');
const { normalizeAmount } = require('../utils/money');
const axios = require('axios');
const momoProvider = require('../providers/momo_provider');
const vnpayProvider = require('../providers/vnpay_provider');

const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3003/api/v1';

async function resolveRestaurantId(idOrSlug) {
  try {
    const resResp = await axios.get(`${RESTAURANT_SERVICE_URL}/restaurants/${idOrSlug}`);
    const resData = resResp.data?.data || resResp.data;
    if (resData && resData.id) return resData.id;
  } catch (err) {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);
    if (isUuid) return idOrSlug;
    throw new Error('Restaurant not found or invalid id/slug');
  }
  return idOrSlug;
}

async function createWalletTopup({ restaurantId, provider, amount, req }) {
  const normalizedProvider = String(provider || '').toUpperCase();
  // Hỗ trợ cả UUID và slug — resolve về UUID thật trước khi thao tác
  const resolvedRestaurantId = await resolveRestaurantId(restaurantId);
  const redis = await getRedis();
  const lockKey = `payment:wallet:topup:create:${resolvedRestaurantId}`;
  const locked = await redis.set(lockKey, '1', { NX: true, EX: 30 });

  if (!locked) {
    const e = new Error('Wallet top-up is being processed');
    e.status = 409;
    throw e;
  }

  try {
    const wallet = await paymentModel.findWalletByRestaurantId(resolvedRestaurantId);

    if (!wallet) throw new Error('Restaurant wallet not found');
    if (wallet.status !== 'active') throw new Error('Wallet is not active');

    const pending = await paymentModel.findPendingTopupByWalletId(wallet.id);
    if (pending) {
      const e = new Error('Wallet top-up is pending for this restaurant');
      e.status = 409;
      throw e;
    }

    const normalizedAmount = normalizeAmount(amount);
    const referenceCode = generateReferenceCode('TOP');

    const tx = await paymentModel.createPendingWalletTopupTransaction({
      walletId: wallet.id,
      amount: normalizedAmount,
      currency: wallet.currency,
      paymentMethod: normalizedProvider,
      referenceCode,
      provider: normalizedProvider,
      description: `Top-up wallet for restaurant ${resolvedRestaurantId}`,
      idempotencyKey: referenceCode
    });

    let providerPayload;
    if (normalizedProvider === 'MOMO') {
      providerPayload = await momoProvider.createPayment({
        amount: normalizedAmount,
        referenceCode,
        bookingCode: `TOPUP-${resolvedRestaurantId}`,
        bookingId: null
      });
    } else if (normalizedProvider === 'VNPAY') {
      providerPayload = await vnpayProvider.createPayment({
        amount: normalizedAmount,
        referenceCode,
        bookingCode: `TOPUP-${resolvedRestaurantId}`,
        bookingId: null,
        req
      });
    } else {
      throw new Error('Unsupported provider');
    }

    return {
      transactionId: tx.id,
      referenceCode,
      provider: normalizedProvider,
      amount: normalizedAmount,
      currency: wallet.currency,
      ...providerPayload
    };
  } finally {
    await redis.del(lockKey);
  }
}

async function getWalletBalance({ restaurantId }) {
  const resolvedId = await resolveRestaurantId(restaurantId);
  const walletStats = await paymentModel.getWalletStatistics(resolvedId);
  if (!walletStats) throw new Error('Restaurant wallet not found');
  return walletStats;
}

async function getWalletHistory({ restaurantId, type }) {
  const resolvedId = await resolveRestaurantId(restaurantId);
  const wallet = await paymentModel.findWalletByRestaurantId(resolvedId);
  if (!wallet) throw new Error('Restaurant wallet not found');
  return paymentModel.getWalletTransactions(wallet.id, type);
}

async function chargeCommission({ restaurantId, adminUserId, amount, description, idempotencyKey }) {
  const redis = await getRedis();
  const lockKey = idempotencyKey
    ? `payment:wallet:commission:idempotency:${idempotencyKey}`
    : `payment:wallet:commission:charge:${restaurantId}:${adminUserId}`;
  const locked = await redis.set(lockKey, '1', { NX: true, EX: 15 });

  if (!locked) {
    const e = new Error('Commission charge is being processed');
    e.status = 409;
    throw e;
  }

  try {
    if (idempotencyKey) {
      const existing = await paymentModel.findTransactionByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          success: true,
          idempotent: true,
          transactionId: existing.id,
          referenceCode: existing.referenceCode,
          amount: Number(existing.amount || 0),
          status: existing.status
        };
      }
    }

    const restaurantWallet = await paymentModel.findWalletByRestaurantId(restaurantId);
    if (!restaurantWallet) throw new Error('Restaurant wallet not found');
    if (restaurantWallet.status !== 'active') throw new Error('Restaurant wallet is not active');

    const adminWallet = await paymentModel.findWalletByUserId(adminUserId);
    if (!adminWallet) throw new Error('Admin wallet not found');
    if (adminWallet.status !== 'active') throw new Error('Admin wallet is not active');

    if (restaurantWallet.currency !== adminWallet.currency) {
      throw new Error('Wallet currency mismatch');
    }

    const normalizedAmount = normalizeAmount(amount);

    return paymentModel.chargeCommissionFromRestaurantToAdmin({
      restaurantWalletId: restaurantWallet.id,
      adminWalletId: adminWallet.id,
      amount: normalizedAmount,
      currency: restaurantWallet.currency,
      description,
      referenceCode: generateReferenceCode('COM'),
      idempotencyKey
    });
  } finally {
    await redis.del(lockKey);
  }
}

async function getRecentTransactions({ restaurantId, limit = 5 }) {
  const resolvedId = await resolveRestaurantId(restaurantId);
  const wallet = await paymentModel.findWalletByRestaurantId(resolvedId);
  if (!wallet) throw new Error('Restaurant wallet not found');
  return paymentModel.getRecentRestaurantTransactions(resolvedId, limit);
}

module.exports = {
  createWalletTopup,
  getWalletBalance,
  getWalletHistory,
  getRecentTransactions,
  chargeCommission
};
