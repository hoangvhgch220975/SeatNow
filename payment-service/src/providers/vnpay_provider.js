// vnpay.provider.js
// Adapter làm việc với cổng thanh toán VNPay.
// Nhiệm vụ chính: tạo URL thanh toán, ký/xác thực chữ ký và chuẩn hóa dữ liệu callback.

const { VNPay, ignoreLogger, ProductCode, dateFormat } = require('vnpay');

function getVNPayClient() {
  return new VNPay({
    tmnCode: process.env.VNPAY_TMN_CODE,
    secureSecret: process.env.VNPAY_HASH_SECRET,
    vnpayHost: 'https://sandbox.vnpayment.vn',
    testMode: true,
    hashAlgorithm: 'SHA512',
    loggerFn: ignoreLogger
  });
}

// Lấy IP client để gửi cho VNPay
function getClientIp(req) {
  const rawIp = String(
    req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req?.socket?.remoteAddress ||
    '127.0.0.1'
  );

  return rawIp.replace('::ffff:', '');
}

// Tạo URL thanh toán VNPay
async function createPayment({ amount, referenceCode, bookingId, bookingCode, req }) {
  const vnpay = getVNPayClient();

  const paymentUrl = await vnpay.buildPaymentUrl({
    vnp_Amount: Math.floor(Number(amount)),
    vnp_IpAddr: getClientIp(req),
    vnp_TxnRef: referenceCode,
    vnp_OrderInfo: `Deposit for booking ${bookingCode}`,
    vnp_OrderType: ProductCode.Other,
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
    vnp_CreateDate: dateFormat(new Date(), 'yyyyMMddHHmmss'),
    vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000), 'yyyyMMddHHmmss')
  });

  return {
    paymentUrl,
    deeplink: null,
    qrCodeUrl: null,
    rawProviderResponse: null
  };
}

// Xác thực chữ ký trả về từ VNPay
function verifyVNPaySignature(query) {
  try {
    if (!query || !query.vnp_SecureHash) return false;
    const vnpay = getVNPayClient();
    const result = vnpay.verifyReturnUrl(query);
    return !!result.isVerified;
  } catch {
    return false;
  }
}

// Chuẩn hóa payload callback/webhook của VNPay
function parseWebhookPayload(query) {
  return {
    referenceCode: query.vnp_TxnRef,
    providerTxnId: query.vnp_TransactionNo ? String(query.vnp_TransactionNo) : null,
    success: query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00',
    rawPayload: query
  };
}

// Dữ liệu return của VNPay dùng chung format với webhook
function parseReturnPayload({ query }) {
  return parseWebhookPayload(query);
}

module.exports = {
  createPayment,
  verifyWebhookSignature: verifyVNPaySignature,
  parseWebhookPayload,
  parseReturnPayload
};
