// momo.provider.js
// Adapter làm việc với cổng thanh toán MoMo.
// Nhiệm vụ chính: tạo request thanh toán, ký dữ liệu, và chuẩn hóa dữ liệu callback/webhook.

const axios = require('axios');
const { hmacSha256 } = require('../utils/signature');

// Tạo nội dung mô tả đơn hàng gửi sang MoMo
function buildOrderInfo(bookingCode) {
  return `Deposit for booking ${bookingCode}`;
}

// Tạo yêu cầu thanh toán đến MoMo và trả về URL thanh toán
async function createPayment({ amount, referenceCode, bookingId, bookingCode }) {
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const endpoint = process.env.MOMO_ENDPOINT;
  const redirectUrl = process.env.MOMO_RETURN_URL;
  const ipnUrl = process.env.MOMO_NOTIFY_URL;

  const requestType = 'payWithMethod';
  const orderId = referenceCode;
  const requestId = referenceCode;
  const orderInfo = buildOrderInfo(bookingCode);
  const extraData = '';
  const autoCapture = true;
  const lang = 'vi';
  const amountStr = String(Math.floor(Number(amount)));

  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${amountStr}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`;

  const signature = hmacSha256(secretKey, rawSignature);

  const body = {
    partnerCode,
    partnerName: 'SeatNow',
    storeId: 'SeatNow.com',
    requestId,
    amount: amountStr,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang,
    requestType,
    autoCapture,
    extraData,
    orderGroupId: '',
    signature
  };

  const { data } = await axios.post(endpoint, body, {
    headers: { 'Content-Type': 'application/json' }
  });

  return {
    paymentUrl: data.payUrl,
    deeplink: data.deeplink || null,
    qrCodeUrl: data.qrCodeUrl || null,
    rawProviderResponse: data
  };
}

// Chuẩn hóa payload webhook từ MoMo về format chung của service
function parseWebhookPayload(payload) {
  return {
    referenceCode: payload.orderId,
    providerTxnId: payload.transId ? String(payload.transId) : null,
    success: Number(payload.resultCode) === 0,
    rawPayload: payload
  };
}

// Xác thực chữ ký webhook để đảm bảo callback hợp lệ từ MoMo
function verifyWebhookSignature(payload) {
  const secretKey = process.env.MOMO_SECRET_KEY;
  const signature = payload.signature;

  if (!signature) return false;

  const rawSignature =
    `accessKey=${process.env.MOMO_ACCESS_KEY}` +
    `&amount=${payload.amount}` +
    `&extraData=${payload.extraData || ''}` +
    `&message=${payload.message || ''}` +
    `&orderId=${payload.orderId}` +
    `&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType || ''}` +
    `&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType || ''}` +
    `&requestId=${payload.requestId}` +
    `&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}` +
    `&transId=${payload.transId}`;

  const expected = hmacSha256(secretKey, rawSignature);
  return expected === signature;
}

// Payload return có thể nằm ở query hoặc body, gom về một format để xử lý
function parseReturnPayload({ query, body }) {
  const payload = Object.keys(query || {}).length ? query : body;
  return parseWebhookPayload(payload);
}

module.exports = {
  createPayment,
  parseWebhookPayload,
  parseReturnPayload,
  verifyWebhookSignature
};