/**
 * booking.service.js - core booking rules (placeholder)
 */
const { getRedis } = require('../config/redis');
const { getPool } = require('../config/db');
const { acquireLock, releaseLock } = require('../utils/lock_redis');
const bookingSql = require('../models/booking_sql');
const availability = require('./availability_service');
const socket = require('../sockets/booking_socket');
const { notificationQueue } = require('../queues/notification.queue');

// Helper to format date/time from SQL return
function formatDate(d) {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toISOString().split('T')[0];
  } catch (e) { return String(d); }
}

function formatTime(t) {
  if (!t) return '';
  try {
    const date = new Date(t);
    if (isNaN(date.getTime())) return String(t);
    // HH:mm
    return date.toISOString().split('T')[1].substring(0, 5);
  } catch (e) { return String(t); }
}

// Hàm sinh mã booking
function genCode() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `BK${yyyy}${mm}${dd}${rnd}`;
}

// Hàm tính tiền đặt cọc dựa trên chính sách của nhà hàng
function computeDeposit(restaurant, numGuests) {
  if (!restaurant.depositEnabled) return { depositRequired: false, depositAmount: 0 };

  // Hỗ trợ cả trường hợp policy lưu dạng object hoặc JSON string
  let policy = null;
  try {
    policy = typeof restaurant.depositPolicyJson === 'string'
      ? (restaurant.depositPolicyJson ? JSON.parse(restaurant.depositPolicyJson) : null)
      : (restaurant.depositPolicyJson || null);
  } catch {}
  if (!policy) return { depositRequired: true, depositAmount: 0 };

  // Nếu policy khai báo không yêu cầu đặt cọc thì bỏ qua
  if (policy.required === false) return { depositRequired: false, depositAmount: 0 };

  // Chấp nhận nhiều tên key để tương thích dữ liệu cũ/mới
  const minGuests = Number(
    policy.minGuests ?? policy.min_guests ?? policy.minimumGuests ?? policy.minPartySize ?? 0
  );
  if (numGuests < minGuests) return { depositRequired: false, depositAmount: 0 };

  const rawType = String(policy.type ?? policy.depositType ?? '').toLowerCase();
  const isPerPerson = rawType === 'per_person' || rawType === 'perperson' || rawType === 'per-person';

  // Theo format hiện tại: chỉ lấy tiền cọc từ minAmount
  // Hỗ trợ thêm monAmount trong trường hợp dữ liệu cũ bị gõ nhầm key.
  const baseAmount = Number(policy.minAmount ?? policy.monAmount ?? 0);

  let amount = isPerPerson
    ? baseAmount * Number(numGuests || 0)
    : baseAmount;

  if (!Number.isFinite(amount) || amount < 0) amount = 0;

  return { depositRequired: true, depositAmount: amount };
}

// Hàm tạo booking
async function createBooking({ actor, body }) {
  const r = await bookingSql.getRestaurant(body.restaurantId);
  if (!r || String(r.status).toLowerCase() !== 'active') {
    const e = new Error('Restaurant not found or not active'); e.status = 404; throw e;
  }

  // guest rule
  if (!actor && (!body.guestPhone || !body.guestName)) {
    const e = new Error('Guest booking requires guestName and guestPhone'); e.status = 422; throw e;
  }

  // table selection: if not provided -> pick smallest available
  let tableId = body.tableId || null;
  if (!tableId) {
    const tables = await availability.getAvailableTables({
      restaurantId: body.restaurantId,
      bookingDate: body.bookingDate,
      bookingTime: body.bookingTime,
      numGuests: body.numGuests
    });
    if (!tables.length) { const e = new Error('No available tables'); e.status = 409; throw e; }
    tableId = tables[0].id;
  } else {
    const t = await bookingSql.getTable(tableId);
    if (!t) { const e = new Error('Table not found'); e.status = 404; throw e; }
    if (String(t.restaurantId) !== String(body.restaurantId)) { const e = new Error('Table not in restaurant'); e.status = 400; throw e; }
    if (t.capacity < body.numGuests) { const e = new Error('Table capacity not enough'); e.status = 400; throw e; }
    if (String(t.status).toLowerCase() !== 'available') { const e = new Error('Table not available'); e.status = 409; throw e; }
  }

  const { depositRequired, depositAmount } = computeDeposit(r, body.numGuests);
  const status = 'PENDING'; // Booking mới luôn là PENDING, chờ restaurant xác nhận
  
  // Tổng commission = (Phần trăm tiền cọc nếu có) + (10.000 VNĐ x Số khách)
  const depositCommission = depositRequired ? depositAmount * (Number(r.commissionRate || 0) / 100) : 0;
  const guestCommission = Number(body.numGuests || 0) * 10000;
  const commissionFee = depositCommission + guestCommission;

  // lock by table+slot
  const redis = await getRedis();
  const ttl = parseInt(process.env.BOOKING_LOCK_TTL_SEC || '60', 10);
  const lockKey = `booking:lock:${body.restaurantId}:${tableId}:${body.bookingDate}:${body.bookingTime}`;
  const token = await acquireLock(redis, lockKey, ttl);
  if (!token) { const e = new Error('This table/time is being booked'); e.status = 409; throw e; }

  try {
    const row = await bookingSql.insertBookingTx({
      bookingCode: genCode(),
      customerId: actor?.id || null,
      guestName: actor ? null : body.guestName,
      guestPhone: actor ? null : body.guestPhone,
      guestEmail: actor ? null : body.guestEmail,

      restaurantId: body.restaurantId,
      tableId,
      bookingDate: body.bookingDate,
      bookingTime: body.bookingTime,
      numGuests: body.numGuests,

      status,
      specialRequests: body.specialRequests || null,

      depositRequired,
      depositAmount,
      commissionFee
    });

    // Emit realtime events: booking created and availability changed
    try {
      socket.emitBookingChanged({ restaurantId: body.restaurantId, customerId: actor?.id, payload: { type: 'created', booking: row } });
      socket.emitAvailabilityChanged(body.restaurantId, { bookingDate: body.bookingDate, bookingTime: body.bookingTime });
      
      // Notify Restaurant Owner via Web Socket (Dashboard)
      notificationQueue.add({
        type: 'web',
        payload: {
          userId: r.ownerId,
          event: 'booking_created',
          message: `New order: ${row.bookingCode}`,
          data: { booking: row, restaurant: r }
        }
      });
    } catch (e) {
      console.error('Error triggering notifications for createBooking', e);
    }

    // Auto-release hold lock if existed
    const holdKey = `table:hold:${body.restaurantId}:${tableId}:${body.bookingDate}:${body.bookingTime}`;
    try { await redis.del(holdKey); } catch (e) {}

    // Phát sự kiện mới: Bàn đã được đặt (màu đỏ - occupied)
    try {
      socket.emitTableStatusChanged({
        restaurantId: body.restaurantId,
        tableId,
        bookingDate: body.bookingDate,
        bookingTime: body.bookingTime,
        status: 'occupied'
      });
    } catch (e) {
      console.error('Error emitting tableStatusChanged for createBooking', e);
    }

    return { booking: row, depositRequired, depositAmount };
  } finally {
    await releaseLock(redis, lockKey, token);
  }
}
// Hàm tìm booking theo mã và số điện thoại khách
async function guestLookup({ bookingCode, guestPhone }) {
  return bookingSql.findByCodeAndGuestPhone(bookingCode, guestPhone);
}

// Hàm liệt kê booking theo khách hàng
async function myBookings(actor, { limit = 20, offset = 0 }) {
  return bookingSql.listByCustomer(actor.id, { limit, offset });
}

// Hàm liệt kê booking theo nhà hàng
async function restaurantBookings(restaurantId, actor, filters) {
  const r = await bookingSql.getRestaurant(restaurantId);
  if (!r) { const e = new Error('Restaurant not found'); e.status = 404; throw e; }
    // Debug: log actor id/role and restaurant ownerId to help diagnose Forbidden cases
    try { console.log('[restaurantBookings] actor:', actor ? { id: actor.id, role: actor.role } : null, 'restaurantOwnerId:', r.ownerId); } catch (e) {}
  if (actor.role !== 'ADMIN' && String(r.ownerId) !== String(actor.id)) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  return bookingSql.listByRestaurant(restaurantId, filters);
  
}

// Kiểm tra actor có quyền owner/admin trên restaurant
async function ensureRestaurantAccess(restaurantId, actor) {
  const r = await bookingSql.getRestaurant(restaurantId);
  if (!r) { const e = new Error('Restaurant not found'); e.status = 404; throw e; }
  if (actor.role !== 'ADMIN' && String(r.ownerId) !== String(actor.id)) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return r;
}

// Xem tổng hợp commission theo nhà hàng
async function commissionSummary(restaurantId, actor, { from, to } = {}) {
  await ensureRestaurantAccess(restaurantId, actor);
  return bookingSql.getCommissionSummaryByRestaurant(restaurantId, { from, to });
}

// Thống kê doanh thu theo nhà hàng
async function getRevenueStatistics(restaurantId, actor, { period, from, to } = {}) {
  await ensureRestaurantAccess(restaurantId, actor);
  return bookingSql.getRevenueStatistics(restaurantId, { period, from, to });
}

// Chốt thu commission theo kỳ (đánh dấu commissionPaid=1)
async function settleCommission(restaurantId, actor, { from, to, minAgeMinutes } = {}) {
  if (String(process.env.COMMISSION_SETTLE_VIA_BOOKING || '').toLowerCase() !== 'true') {
    const e = new Error('Direct settle via booking-service is disabled. Use admin-service /commissions/settle-quarter');
    e.status = 409;
    throw e;
  }

  await ensureRestaurantAccess(restaurantId, actor);
  const effectiveMinAge = Number(minAgeMinutes ?? process.env.COMMISSION_SETTLE_MIN_AGE_MIN ?? 0);
  return bookingSql.settleCommissionByRestaurant(restaurantId, {
    from,
    to,
    minAgeMinutes: Number.isFinite(effectiveMinAge) ? effectiveMinAge : 0
  });
}

// Internal API: lay booking candidates de admin-service xu ly charge that.
async function getCommissionCandidatesInternal({ from, to, minAgeMinutes, restaurantIds } = {}) {
  const effectiveMinAge = Number(minAgeMinutes ?? process.env.COMMISSION_SETTLE_MIN_AGE_MIN ?? 0);
  const rows = await bookingSql.listCommissionCandidates({
    from,
    to,
    minAgeMinutes: Number.isFinite(effectiveMinAge) ? effectiveMinAge : 0,
    restaurantIds: Array.isArray(restaurantIds) ? restaurantIds : []
  });

  return {
    totalBookings: rows.length,
    totalAmount: rows.reduce((sum, x) => sum + Number(x.commissionFee || 0), 0),
    items: rows
  };
}

// Internal API: booking nao charge thanh cong thi moi mark commissionPaid.
async function markCommissionPaidInternal({ bookingIds } = {}) {
  return bookingSql.markCommissionPaidByBookingIds(Array.isArray(bookingIds) ? bookingIds : []);
}

// Job tự động chốt commission cho tất cả nhà hàng có booking đủ điều kiện
async function autoSettleCommissions() {
  // Legacy mode: auto mark chi de tuong thich ban cu, mac dinh tat.
  if (String(process.env.COMMISSION_AUTO_MARK_LEGACY || '').toLowerCase() !== 'true') {
    return [];
  }

  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT DISTINCT restaurantId
    FROM dbo.Bookings
    WHERE status IN ('ARRIVED', 'COMPLETED')
      AND depositRequired=1
      AND depositPaid=1
      AND commissionPaid=0
      AND ISNULL(commissionFee, 0) > 0
  `);

  const minAgeMinutes = Number(process.env.COMMISSION_SETTLE_MIN_AGE_MIN || 0);
  const out = [];
  for (const row of rs.recordset || []) {
    const result = await bookingSql.settleCommissionByRestaurant(row.restaurantId, { minAgeMinutes });
    if (result.affectedCount > 0) {
      out.push({ restaurantId: row.restaurantId, ...result });
    }
  }
  return out;
}

/** transitions (flow strict) */
// PENDING -> CONFIRMED
async function confirm(idOrCode) {
  let id = idOrCode;
  if (!bookingSql.isValidGuid(idOrCode)) {
    const b = await bookingSql.findByCode(idOrCode);
    if (!b) { const e = new Error('Booking not found by code ' + idOrCode); e.status = 404; throw e; }
    id = b.id;
  }
  const updated = await bookingSql.updateStatus(id, ['PENDING'], 'CONFIRMED', 'confirmedAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  
  try { 
    socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'confirmed', booking: updated } }); 
    
    // Đảm bảo trạng thái bàn vẫn là occupied khi confirm (màu đỏ)
    socket.emitTableStatusChanged({
      restaurantId: updated.restaurantId,
      tableId: updated.tableId,
      bookingDate: formatDate(updated.bookingDate),
      bookingTime: formatTime(updated.bookingTime),
      status: 'occupied'
    });
    
    // Notify Customer via Email
    const r = await bookingSql.getRestaurant(updated.restaurantId);
    let recipientEmail = updated.guestEmail;
    
    // If registered customer, fetch their email if not in guestEmail
    if (!recipientEmail && updated.customerId) {
       const pool = await require('../config/db').getPool();
       const userRs = await pool.request().input('id', require('../config/db').sql.UniqueIdentifier, updated.customerId).query('SELECT email FROM dbo.Users WHERE id=@id');
       recipientEmail = userRs.recordset[0]?.email;
    }

    if (r && recipientEmail) {
      notificationQueue.add({
        type: 'email',
        payload: {
          to: recipientEmail,
          templateType: 'booking_confirmed',
          data: {
            guestName: updated.guestName || 'Guest',
            restaurantName: r.restaurantName,
            bookingCode: updated.bookingCode,
            bookingDate: formatDate(updated.bookingDate),
            bookingTime: formatTime(updated.bookingTime),
            numGuests: updated.numGuests,
            address: r.restaurantAddress
          }
        }
      });
    }
  } catch (e) {}
  return updated;
}

// CONFIRMED -> ARRIVED
async function arrived(idOrCode) {
  let id = idOrCode;
  if (!bookingSql.isValidGuid(idOrCode)) {
    const b = await bookingSql.findByCode(idOrCode);
    if (!b) { const e = new Error('Booking not found by code ' + idOrCode); e.status = 404; throw e; }
    id = b.id;
  }
  // nếu DB cột là checkedInAt, bạn có thể dùng checkedInAt thay arrivedAt
  const updated = await bookingSql.updateStatus(id, ['CONFIRMED'], 'ARRIVED', 'arrivedAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'arrived', booking: updated } }); } catch (e) {}
  return updated;
}

// ARRIVED -> COMPLETED
async function complete(idOrCode) {
  let id = idOrCode;
  if (!bookingSql.isValidGuid(idOrCode)) {
    const b = await bookingSql.findByCode(idOrCode);
    if (!b) { const e = new Error('Booking not found by code ' + idOrCode); e.status = 404; throw e; }
    id = b.id;
  }
  const updated = await bookingSql.updateStatus(id, ['ARRIVED'], 'COMPLETED', 'completedAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }

  // Giải phóng trạng thái bàn (trở về màu xanh)
  try {
    socket.emitTableStatusChanged({
      restaurantId: updated.restaurantId,
      tableId: updated.tableId,
      bookingDate: formatDate(updated.bookingDate),
      bookingTime: formatTime(updated.bookingTime),
      status: 'available'
    });
  } catch (e) {
    console.error('Error emitting tableStatusChanged for complete', e);
  }

  // Award loyalty points for registered customers
  if (updated.customerId) {
    let points = 0;
    if (updated.depositPaid && updated.depositAmount > 0) {
      // 10,000 VND = 1 point
      points = Math.floor(Number(updated.depositAmount) / 10000);
    } else {
      // No deposit or deposit not paid: 1 guest = 1 point
      points = Number(updated.numGuests || 0);
    }

    if (points > 0) {
      try {
        await bookingSql.incrementUserLoyaltyPoints(updated.customerId, points);
        console.log(`[LoyaltyPoints] Awarded ${points} points to user ${updated.customerId} for booking ${updated.bookingCode}`);
      } catch (err) {
        console.error('[LoyaltyPoints] Error awarding points:', err);
      }
    }
  }

  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'completed', booking: updated } }); } catch (e) {}
  return updated;
}

// PENDING/CONFIRMED -> CANCELLED
async function cancel(idOrCode, actor = null, cancellationReason = null) {
  let id = idOrCode;
  if (!bookingSql.isValidGuid(idOrCode)) {
    const b = await bookingSql.findByCode(idOrCode);
    if (!b) { const e = new Error('Booking not found'); e.status = 404; throw e; }
    id = b.id;
  }
  const booking = await bookingSql.findById(id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }

  // Check permission
  if (actor) {
    if (actor.role === 'CUSTOMER') {
      if (booking.customerId && String(booking.customerId) !== String(actor.id)) {
        const e = new Error('Forbidden: You can only cancel your own booking'); e.status = 403; throw e;
      }
    } else if (actor.role === 'RESTAURANT_OWNER') {
      const r = await bookingSql.getRestaurant(booking.restaurantId);
      if (!r || String(r.ownerId) !== String(actor.id)) {
        const e = new Error('Forbidden: You are not the owner of this restaurant'); e.status = 403; throw e;
      }
    }
  }

  // Store role (e.g., 'CUSTOMER') in cancelledBy column
  const cancelledBy = actor?.role || null;

  // Logic Hoàn tiền (Refund)
  let shouldRefund = false;
  if (actor?.role === 'RESTAURANT_OWNER' || actor?.role === 'ADMIN') {
    shouldRefund = true;
  } else if (actor?.role === 'CUSTOMER') {
    try {
      const bDate = new Date(booking.bookingDate);
      const year = bDate.getUTCFullYear();
      const month = bDate.getUTCMonth();
      const day = bDate.getUTCDate();

      let hours = 0, minutes = 0;
      if (booking.bookingTime instanceof Date) {
        hours = booking.bookingTime.getUTCHours();
        minutes = booking.bookingTime.getUTCMinutes();
      } else if (typeof booking.bookingTime === 'string') {
        const parts = booking.bookingTime.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
      }
      
      const startTime = new Date(year, month, day, hours, minutes, 0, 0);
      const now = new Date();
      const diffMs = startTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Log for debugging
      console.log('[Cancel] Refund Debug:', {
        bookingId: id,
        year, month, day, hours, minutes,
        startTime: startTime.toLocaleString(),
        now: now.toLocaleString(),
        diffHours,
        actorRole: actor?.role
      });
      
      if (diffHours >= 3) {
        shouldRefund = true;
      }
    } catch (e) {
      console.error('[Cancel] Error calculating refund window:', e);
    }
  }

  const updated = await bookingSql.cancelBooking(id, ['PENDING','CONFIRMED'], cancelledBy, cancellationReason, shouldRefund);
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  
  // Giải phóng trạng thái bàn khi hủy (trở về màu xanh)
  try {
    socket.emitTableStatusChanged({
      restaurantId: updated.restaurantId,
      tableId: updated.tableId,
      bookingDate: formatDate(updated.bookingDate),
      bookingTime: formatTime(updated.bookingTime),
      status: 'available'
    });
  } catch (e) {
    console.error('Error emitting tableStatusChanged for cancel', e);
  }
  try { 
    socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'cancelled', booking: updated } }); 
    
    const r = await bookingSql.getRestaurant(updated.restaurantId);
    if (r) {
      if (actor?.role === 'CUSTOMER') {
        // Notify Owner
        notificationQueue.add({
          type: 'web',
          payload: {
            userId: r.ownerId,
            event: 'booking_cancelled',
            message: `Customer cancelled: ${updated.bookingCode}`,
            data: { booking: updated }
          }
        });
      } else {
        // Notify Customer (Cancelled by Restaurant/Admin)
        let recipientEmail = updated.guestEmail;
        if (!recipientEmail && updated.customerId) {
          const pool = await require('../config/db').getPool();
          const userRs = await pool.request().input('id', require('../config/db').sql.UniqueIdentifier, updated.customerId).query('SELECT email FROM dbo.Users WHERE id=@id');
          recipientEmail = userRs.recordset[0]?.email;
        }

        if (recipientEmail) {
          notificationQueue.add({
            type: 'email',
            payload: {
              to: recipientEmail,
              templateType: 'booking_cancelled',
              data: {
                guestName: updated.guestName || 'Guest',
                restaurantName: r.restaurantName,
                bookingCode: updated.bookingCode,
                reason: cancellationReason || 'Restaurant adjustment'
              }
            }
          });
        }
      }
    }
  } catch (e) {}
  return updated;
}

// CONFIRMED -> NO_SHOW
async function noShow(idOrCode) {
  let id = idOrCode;
  if (!bookingSql.isValidGuid(idOrCode)) {
    const b = await bookingSql.findByCode(idOrCode);
    if (!b) { const e = new Error('Booking not found'); e.status = 404; throw e; }
    id = b.id;
  }
  const updated = await bookingSql.updateStatus(id, ['CONFIRMED'], 'NO_SHOW', 'cancelledAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  
  // Giải phóng trạng thái bàn khi khách không đến (trở về màu xanh)
  try {
    socket.emitTableStatusChanged({
      restaurantId: updated.restaurantId,
      tableId: updated.tableId,
      bookingDate: formatDate(updated.bookingDate),
      bookingTime: formatTime(updated.bookingTime),
      status: 'available'
    });
  } catch (e) {
    console.error('Error emitting tableStatusChanged for noShow', e);
  }

  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'no_show', booking: updated } }); } catch (e) {}
  return updated;
}

// Lấy chi tiết booking kèm thông tin restaurant (dùng cho access control và trả về dữ liệu)
async function getBookingDetails(idOrCode) {
  let id = idOrCode;
  if (!bookingSql.isValidGuid(idOrCode)) {
    const b = await bookingSql.findByCode(idOrCode);
    if (!b) return null;
    id = b.id;
  }
  const booking = await bookingSql.findById(id);
  if (!booking) return null;
  const restaurant = booking.restaurantId ? await bookingSql.getRestaurant(booking.restaurantId) : null;
  return { booking, restaurant };
}


// Lấy tình trạng đặt cọc (payment status)
async function getPaymentStatus(id) {
  const booking = await bookingSql.findById(id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  
  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    bookingStatus: booking.status,
    depositRequired: booking.depositRequired,
    depositAmount: booking.depositAmount,
    depositPaid: booking.depositPaid,
    depositPaidAt: booking.depositPaidAt,
    depositRefunded: booking.depositRefunded,
    message: booking.depositRequired 
      ? (booking.depositPaid ? 'Deposit Paid' : 'Deposit Pending')
      : 'No Deposit Required'
  };
}

// Xử lý tín hiệu nạp tiền cọc thành công (trigger từ payment-service)
async function paymentSuccess(id) {
  const booking = await bookingSql.findById(id);
  if (!booking) { 
    const e = new Error('Booking not found'); 
    e.status = 404; 
    throw e; 
  }
  
  try { 
    socket.emitBookingChanged({ 
      restaurantId: booking.restaurantId, 
      customerId: booking.customerId, 
      payload: { type: 'payment_success', booking } 
    }); 
  } catch (e) {
    console.error('Error emitting payment_success socket event', e);
  }
  return booking;
}

// Thống kê Portfolio cho Chủ chuỗi nhà hàng (Global)
async function getOwnerPortfolioSummary(actor, filters = {}) {
  const data = await bookingSql.getOwnerPortfolioSummary(actor.id, filters);

  const calculatePercentages = (counts, total) => {
    if (!total || total === 0) return { percentCouple: 0, percentSmallGroup: 0, percentParty: 0 };
    return {
      percentCouple: parseFloat(((counts.couple / total) * 100).toFixed(2)),
      percentSmallGroup: parseFloat(((counts.smallGroup / total) * 100).toFixed(2)),
      percentParty: parseFloat(((counts.party / total) * 100).toFixed(2))
    };
  };

  // Tính % cho Global Summary
  const globalPercentages = calculatePercentages(data.summary.guestSizeCounts, data.summary.totalBookings);
  Object.assign(data.summary.guestSizeCounts, globalPercentages);

  // Tính % cho từng nhà hàng trong Breakdown
  data.breakdown = data.breakdown.map(item => {
    const itemPercentages = calculatePercentages(item.guestSizeCounts, item.totalBookings);
    Object.assign(item.guestSizeCounts, itemPercentages);
    return item;
  });

  return data;
}

// Thống kê Summary cho DUY NHẤT một nhà hàng (không theo period)
async function getRestaurantStatsSummary(restaurantId, actor, filters = {}) {
  const restaurant = await bookingSql.getRestaurant(restaurantId);
  if (!restaurant) {
    const e = new Error('Restaurant not found'); e.status = 404; throw e;
  }

  // Quyền: ADMIN hoặc Chủ sở hữu nhà hàng đó
  if (actor.role !== 'ADMIN' && restaurant.ownerId !== actor.id) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }

  const data = await bookingSql.getRestaurantStatsSummary(restaurantId, filters);
  
  if (data.totalBookings > 0) {
    data.guestSizeCounts.percentCouple = parseFloat(((data.guestSizeCounts.couple / data.totalBookings) * 100).toFixed(2));
    data.guestSizeCounts.percentSmallGroup = parseFloat(((data.guestSizeCounts.smallGroup / data.totalBookings) * 100).toFixed(2));
    data.guestSizeCounts.percentParty = parseFloat(((data.guestSizeCounts.party / data.totalBookings) * 100).toFixed(2));
  } else {
    data.guestSizeCounts.percentCouple = 0;
    data.guestSizeCounts.percentSmallGroup = 0;
    data.guestSizeCounts.percentParty = 0;
  }

  return data;
}

// Thống kê phân bổ giờ đặt bàn cho một nhà hàng
async function getHourlyBookingStats(restaurantId, actor, { from, to } = {}) {
  await ensureRestaurantAccess(restaurantId, actor);
  return bookingSql.getHourlyBookingStats(restaurantId, { from, to });
}

// Thống kê phân bổ giờ đặt bàn Portfolio cho chủ chuỗi
async function getOwnerHourlyBookingStats(actor, { from, to } = {}) {
  return bookingSql.getOwnerHourlyBookingStats(actor.id, { from, to });
}

module.exports = {
  createBooking,
  guestLookup,
  myBookings,
  getBookingDetails,
  restaurantBookings,
  commissionSummary,
  settleCommission,
  getCommissionCandidatesInternal,
  markCommissionPaidInternal,
  autoSettleCommissions,
  confirm,
  arrived,
  complete,
  cancel,
  noShow,
  getPaymentStatus,
  paymentSuccess,
  getRevenueStatistics,
  getOwnerPortfolioSummary,
  getRestaurantStatsSummary,
  getHourlyBookingStats,
  getOwnerHourlyBookingStats
};

