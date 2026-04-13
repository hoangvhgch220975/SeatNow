// deposit.service.js
// Muc dich: xu ly nghiep vu tao thanh toan dat coc cho booking.
// Trach nhiem:
// - kiem tra dieu kien booking co duoc phep tao giao dich dat coc hay khong
// - tao giao dich pending truoc khi goi cong thanh toan
// - ket noi voi provider de tao QR hoac link thanh toan
// - tra ve thong tin can thiet de client tiep tuc quy trinh thanh toan

// Import model, redis va cac provider thanh toan
const paymentModel = require('../models/payment_sql');
const { getRedis } = require('../config/redis');
const { generateReferenceCode } = require('../utils/reference-code');
const { normalizeAmount } = require('../utils/money');
const momoProvider = require('../providers/momo_provider');
const vnpayProvider = require('../providers/vnpay_provider');

// Tao giao dich dat coc va tra ve thong tin thanh toan cho client
async function generateDepositPayment({ bookingId, provider, req }) {
  // Dung lock Redis de tranh tao trung transaction cho cung booking
  const redis = await getRedis();
  const lockKey = `payment:deposit:create:${bookingId}`;
  const locked = await redis.set(lockKey, '1', { NX: true, EX: 30 });

  if (!locked) throw new Error('Booking payment is being processed');

  try {
    // Validate booking truoc khi tao giao dich dat coc
    const booking = await paymentModel.findBookingForDeposit(bookingId);
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'PENDING') throw new Error('Booking is not pending');
    if (!booking.depositRequired) throw new Error('Booking does not require deposit');
    if (booking.depositPaid) throw new Error('Deposit already paid');

    // Chan tao nhieu request thanh toan neu booking da co transaction dang pending
    // Neu da co transaction dang pending, ta "vô hiệu hóa" no de cho phep tao cai moi (Supersede)
    const pending = await paymentModel.findPendingDepositByBookingId(bookingId);
    if (pending) {
      console.log(`[PAYMENT_AUDIT] Superseding pending transaction ${pending.referenceCode} for booking ${bookingId}`);
      await paymentModel.failTransaction({
        referenceCode: pending.referenceCode,
        metadataJson: JSON.stringify({ reason: 'SUPERSEDED_BY_NEW_REQUEST', timestamp: new Date().toISOString() })
      });
    }

    // Chan truong hop da co giao dich dat coc hoan tat truoc do
    const completed = await paymentModel.findCompletedDepositByBookingId(bookingId);
    if (completed) throw new Error('Deposit already completed');

    // Chuan hoa thong tin giao dich
    const amount = normalizeAmount(booking.depositAmount);
    const currency = 'VND';
    const referenceCode = generateReferenceCode('DEP');
    const payerType = booking.customerId ? 'CUSTOMER_USER' : 'CUSTOMER_GUEST';

    // Tim vi nha hang de lien ket giao dich ngay tu dau
    const wallet = await paymentModel.findWalletByRestaurantId(booking.restaurantId);
    if (!wallet) {
      console.warn(`[PAYMENT_WARNING] Wallet not found for restaurant ${booking.restaurantId}. Transaction will be created without walletId.`);
    }

    // Tao transaction PENDING trong DB truoc khi goi cong thanh toan
    const tx = await paymentModel.createPendingDepositTransaction({
      walletId: wallet?.id, // Gan walletId neu co
      bookingId,
      amount,
      currency,
      paymentMethod: provider,
      referenceCode,
      payerType,
      provider,
      description: `Deposit for booking ${booking.bookingCode}`,
      idempotencyKey: referenceCode
    });

    let providerPayload;

    // Goi provider tuong ung de tao payment URL/QR
    if (provider === 'MOMO') {
      providerPayload = await momoProvider.createPayment({
        amount,
        referenceCode,
        bookingId,
        bookingCode: booking.bookingCode
      });
    } else if (provider === 'VNPAY') {
      providerPayload = await vnpayProvider.createPayment({
        amount,
        referenceCode,
        bookingId,
        bookingCode: booking.bookingCode,
        req
      });
    } else {
      throw new Error('Unsupported provider');
    }

    // Tra ve thong tin giao dich kem payload cua provider
    return {
      transactionId: tx.id,
      referenceCode,
      provider,
      amount,
      currency,
      ...providerPayload
    };
  } finally {
    // Luon giai phong lock, ke ca khi co loi
    await redis.del(lockKey);
  }
}

module.exports = {
  generateDepositPayment
};