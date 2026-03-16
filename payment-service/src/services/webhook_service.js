// webhook.service.js
// Xu ly ket qua callback/webhook tu cong thanh toan.
// Muc tieu: cap nhat transaction dat coc an toan (idempotent), tranh xu ly trung lap.

const paymentModel = require('../models/payment_sql');
const { acquireIdempotency } = require('../utils/idempotency');
const momoProvider = require('../providers/momo_provider');
const vnpayProvider = require('../providers/vnpay_provider');

// Tao URL redirect ve frontend sau khi thanh toan
function buildRedirectUrl({ bookingId, isGuest, success }) {
  const status = success ? 'success' : 'failed';

  if (isGuest) {
    return `${process.env.GUEST_HOME_URL}?payment=${status}`;
  }

  const template = process.env.CUSTOMER_BOOKING_DETAIL_URL_TEMPLATE;
  return `${template.replace('{bookingId}', bookingId)}?payment=${status}`;
}

// Xu ly payload webhook theo tung provider
async function processProviderResult({ provider, payload, verifySignature = true }) {
  let parsed;
  let validSignature = true;

  // Parse payload va kiem tra chu ky theo provider
  if (provider === 'MOMO') {
    if (verifySignature) {
      validSignature = momoProvider.verifyWebhookSignature(payload);
    }
    parsed = momoProvider.parseWebhookPayload(payload);
  } else if (provider === 'VNPAY') {
    if (verifySignature) {
      validSignature = vnpayProvider.verifyWebhookSignature(payload);
    }
    parsed = vnpayProvider.parseWebhookPayload(payload);
  } else {
    throw new Error('Unsupported provider');
  }

  if (!validSignature) {
    throw new Error('Invalid provider signature');
  }

  // Tao khoa idempotency de chan webhook trung lap
  const { referenceCode, providerTxnId, success, rawPayload } = parsed;
  const idempotencyKey = `payment:webhook:${provider}:${referenceCode}:${providerTxnId || 'none'}`;
  const ok = await acquireIdempotency(idempotencyKey, 300);

  if (!ok) {
    return { duplicated: true };
  }

  const tx = await paymentModel.findTransactionByReferenceCode(referenceCode);
  if (!tx) {
    throw new Error('Transaction not found');
  }

  // Neu thanh cong, re nhanh theo loai giao dich.
  if (success) {
    if (tx.type === 'DEPOSIT' || tx.type === 'DEPOSIT_PAYMENT') {
      const depositResult = await paymentModel.completeDepositTransaction({
        referenceCode,
        providerTxnId,
        metadataJson: JSON.stringify(rawPayload)
      });
      
      // Notify booking-service internal API for realtime socket update
      if (depositResult && depositResult.success && depositResult.bookingId) {
        try {
          const bookingBase = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004/api/v1';
          const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
          const headers = internalToken ? { 'x-internal-token': internalToken, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
          
          fetch(`${bookingBase}/internal/bookings/${depositResult.bookingId}/payment-success`, {
            method: 'POST',
            headers
          }).catch(e => console.error('Failed to trigger payment success webhook to booking service', e));
        } catch (e) {
          console.error('Error triggering booking service socket', e);
        }
      }
      return depositResult;
    }

    if (tx.type === 'TOP_UP') {
      return paymentModel.completeWalletTopupTransactionAndIncreaseBalance({
        referenceCode,
        providerTxnId,
        metadataJson: JSON.stringify(rawPayload)
      });
    }

    throw new Error(`Unsupported success flow for transaction type ${tx.type}`);
  }

  // Neu that bai thi cap nhat transaction sang FAILED
  await paymentModel.failTransaction({
    referenceCode,
    providerTxnId,
    metadataJson: JSON.stringify(rawPayload)
  });

  return { success: false };
}

// Xu ly luong return URL (user quay lai tu cong thanh toan)
async function handleProviderReturn({ provider, query, body }) {
  let parsed;

  if (provider === 'MOMO') {
    parsed = momoProvider.parseReturnPayload({ query, body });
  } else if (provider === 'VNPAY') {
    parsed = vnpayProvider.parseReturnPayload({ query, body });
  } else {
    throw new Error('Unsupported provider');
  }

  // Van thu xu ly ket qua nhu webhook; loi thi log va tiep tuc redirect
  try {
    await processProviderResult({
      provider,
      payload: Object.keys(query || {}).length ? query : body,
      verifySignature: true
    });
  } catch (err) {
    console.error('Return processing error:', err.message);
  }

  // Tim transaction va booking de tao URL redirect dung nguoi dung
  const tx = await paymentModel.findTransactionByReferenceCode(parsed.referenceCode);
  if (!tx) {
    return `${process.env.GUEST_HOME_URL}?payment=failed`;
  }

  // Giao dich top-up khong gan booking, redirect ve trang chung.
  if (!tx.bookingId) {
    return `${process.env.GUEST_HOME_URL}?payment=${parsed.success ? 'success' : 'failed'}`;
  }

  const booking = await paymentModel.findBookingForDeposit(tx.bookingId);
  if (!booking) {
    return `${process.env.GUEST_HOME_URL}?payment=failed`;
  }

  return buildRedirectUrl({
    bookingId: booking.id,
    isGuest: !booking.customerId,
    success: parsed.success
  });
}

module.exports = {
  processProviderResult,
  handleProviderReturn
};