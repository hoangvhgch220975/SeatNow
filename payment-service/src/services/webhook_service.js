// webhook.service.js
// Xu ly ket qua callback/webhook tu cong thanh toan.
// Muc tieu: cap nhat transaction dat coc an toan (idempotent), tranh xu ly trung lap.

const paymentModel = require('../models/payment_sql');
const { acquireIdempotency } = require('../utils/idempotency');
const momoProvider = require('../providers/momo_provider');
const vnpayProvider = require('../providers/vnpay_provider');

// Tao URL redirect ve frontend sau khi thanh toan dựa trên loại khách hàng
function buildRedirectUrl({ bookingId, isGuest, success }) {
  const status = success ? 'success' : 'failed';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Neu la khach vang lai -> Ve trang chu
  if (isGuest) {
    return `${frontendUrl}/?payment=${status}`;
  }

  // Neu la thanh vien -> Ve trang lich su don hang cua toi
  // URL: http://localhost:5173/my-bookings/{bookingId}?payment=success
  return `${frontendUrl}/my-bookings/${bookingId}?payment=${status}`;
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

  console.log(`[DEBUG_PAYMENT] Start processing provider result. Provider: ${provider}, Ref: ${referenceCode}`);

  const tx = await paymentModel.findTransactionByReferenceCode(referenceCode);
  if (!tx) {
    console.error(`[DEBUG_PAYMENT] Transaction NOT FOUND: ${referenceCode}`);
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
          
          console.log(`[DEBUG_PAYMENT] Calling Booking Service Socket for ID: ${depositResult.bookingId}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

          fetch(`${bookingBase}/internal/bookings/${depositResult.bookingId}/payment-success`, {
            method: 'POST',
            headers,
            signal: controller.signal
          })
          .then(() => {
            clearTimeout(timeoutId);
            console.log(`[DEBUG_PAYMENT] Booking Service Socket triggered successfully.`);
          })
          .catch(e => {
             clearTimeout(timeoutId);
             console.log(`[DEBUG_PAYMENT] Booking Service Socket trigger SKIPPED/FAILED (Timeout or Error): ${e.message}`);
          });
        } catch (e) {
          console.error('Error triggering booking service socket', e);
        }
      }
      return depositResult;
    }

    if (tx.type === 'TOP_UP') {
      const topupResult = await paymentModel.completeWalletTopupTransactionAndIncreaseBalance({
        referenceCode,
        providerTxnId,
        metadataJson: JSON.stringify(rawPayload)
      });

      // Notify restaurant owner: wallet top-up successful
      if (topupResult && !topupResult.alreadyCompleted) {
        try {
          const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
          const topupMsg = `Wallet top-up successful: ${Number(tx.amount || 0).toLocaleString('vi-VN')} VND (Ref: ${referenceCode})`;
          const topupData = { referenceCode, amount: tx.amount, walletId: tx.walletId };

          // 1. Notify restaurant owner (resolve userId từ walletId trong worker)
          fetch(notifUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'web',
              payload: {
                walletId: tx.walletId,
                restaurantId: tx.restaurantId,
                event: 'TRANSACTION_TOPUP',
                title: 'Wallet Top-up Successful',
                message: topupMsg,
                link: `/restaurant/wallet/transactions/${tx.id}`,
                data: {
                   ...topupData,
                   transactionId: tx.id,
                   restaurantId: tx.restaurantId
                }
              }
            })
          }).catch(err => console.error('[Webhook] Failed to notify owner TOPUP:', err.message));

          // 2. Notify ADMIN real-time: restaurant đã nạp tiền
          fetch(notifUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'web',
              payload: {
                role: 'ADMIN',
                restaurantId: tx.restaurantId,
                event: 'TRANSACTION_TOPUP',
                title: 'Restaurant Top-up Detected',
                message: `[Admin] Restaurant wallet top-up: ${Number(tx.amount || 0).toLocaleString('vi-VN')} VND (Ref: ${referenceCode})`,
                link: '/audit-requests', // Admin links remain the same or adjust as needed
                data: {
                  ...topupData,
                  transactionId: tx.id,
                  restaurantId: tx.restaurantId
                }
              }
            })
          }).catch(err => console.error('[Webhook] Failed to notify admin TOPUP:', err.message));

        } catch (notifErr) {
          console.error('[Webhook] TOPUP notification error:', notifErr.message);
        }
      }

      return topupResult;
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

  console.log(`[Payment Return] Provider: ${provider}, Ref: ${parsed.referenceCode}, Success: ${parsed.success}`);

  // Van thu xu ly ket qua nhu webhook; loi thi log va tiep tuc redirect
  try {
    await processProviderResult({
      provider,
      payload: Object.keys(query || {}).length ? query : body,
      verifySignature: true
    });
  } catch (err) {
    console.warn(`[Payment Return] Non-critical processing error: ${err.message}`);
  }

  // Tim transaction va booking de tao URL redirect dung nguoi dung
  const tx = await paymentModel.findTransactionByReferenceCode(parsed.referenceCode);
  if (!tx) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.warn(`[Payment Return] Transaction ${parsed.referenceCode} not found for redirect.`);
    return { redirectUrl: `${frontendUrl}/?payment=failed`, success: false };
  }

  // Giao dich top-up khong gan booking, redirect ve trang chung.
  if (!tx.bookingId) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return { 
      redirectUrl: `${frontendUrl}/?payment=${parsed.success ? 'success' : 'failed'}`,
      success: parsed.success 
    };
  }

  const booking = await paymentModel.findBookingForDeposit(tx.bookingId);
  if (!booking) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.warn(`[Payment Return] Booking Id ${tx.bookingId} not found.`);
    return { redirectUrl: `${frontendUrl}/?payment=failed`, success: false };
  }

  const finalRedirect = {
    redirectUrl: buildRedirectUrl({
      bookingId: booking.id,
      isGuest: !booking.customerId,
      success: parsed.success
    }),
    success: parsed.success,
    bookingId: booking.id // Explicitly return bookingId
  };

  console.log(`[Payment Return] Success! Final URL: ${finalRedirect.redirectUrl}`);
  return finalRedirect;
}

module.exports = {
  processProviderResult,
  handleProviderReturn
};