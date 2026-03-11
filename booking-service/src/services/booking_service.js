/**
 * booking.service.js - core booking rules (placeholder)
 */
const { getRedis } = require('../config/redis');
const { acquireLock, releaseLock } = require('../utils/lock_redis');
const bookingSql = require('../models/booking_sql');
const availability = require('./availability_service');
const socket = require('../sockets/booking_socket');
const { getBooking } = require('../controllers/booking_controller');

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

  let policy = null;
  try { policy = restaurant.depositPolicyJson ? JSON.parse(restaurant.depositPolicyJson) : null; } catch {}
  if (!policy) return { depositRequired: true, depositAmount: 0 };

  const minGuests = Number(policy.minGuests || 0);
  if (numGuests < minGuests) return { depositRequired: false, depositAmount: 0 };

  const amount = policy.type === 'per_person'
    ? Number(policy.amount || 0) * numGuests
    : Number(policy.amount || 0);

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
  const commissionFee = depositRequired ? depositAmount * (Number(r.commissionRate || 0) / 100) : 0;

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
    } catch (e) {}

    // Auto-release hold lock if existed
    const holdKey = `table:hold:${body.restaurantId}:${tableId}:${body.bookingDate}:${body.bookingTime}`;
    try { await redis.del(holdKey); } catch (e) {}

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

/** transitions (flow strict) */
// PENDING -> CONFIRMED
async function confirm(id) {
  const updated = await bookingSql.updateStatus(id, ['PENDING'], 'CONFIRMED', 'confirmedAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'confirmed', booking: updated } }); } catch (e) {}
  return updated;
}

// CONFIRMED -> ARRIVED
async function arrived(id) {
  // nếu DB cột là checkedInAt, bạn có thể dùng checkedInAt thay arrivedAt
  const updated = await bookingSql.updateStatus(id, ['CONFIRMED'], 'ARRIVED', 'arrivedAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'arrived', booking: updated } }); } catch (e) {}
  return updated;
}

// ARRIVED -> COMPLETED
async function complete(id) {
  const updated = await bookingSql.updateStatus(id, ['ARRIVED'], 'COMPLETED', 'completedAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'completed', booking: updated } }); } catch (e) {}
  return updated;
}

// PENDING/CONFIRMED -> CANCELLED
async function cancel(id, actor = null, cancellationReason = null) {
  // Store role (e.g., 'CUSTOMER') in cancelledBy column (now NVARCHAR)
  const cancelledBy = actor?.role || null;
  const updated = await bookingSql.cancelBooking(id, ['PENDING','CONFIRMED'], cancelledBy, cancellationReason);
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'cancelled', booking: updated } }); } catch (e) {}
  return updated;
}

// CONFIRMED -> NO_SHOW
async function noShow(id) {
  const updated = await bookingSql.updateStatus(id, ['CONFIRMED'], 'NO_SHOW', 'cancelledAt');
  if (!updated) { const e = new Error('Invalid transition'); e.status = 409; throw e; }
  await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
  try { socket.emitBookingChanged({ restaurantId: updated.restaurantId, customerId: updated.customerId, payload: { type: 'no_show', booking: updated } }); } catch (e) {}
  return updated;
}

// Lấy chi tiết booking kèm thông tin restaurant (dùng cho access control và trả về dữ liệu)
async function getBookingDetails(id) {
  const booking = await bookingSql.findById(id);
  if (!booking) return null;
  const restaurant = booking.restaurantId ? await bookingSql.getRestaurant(booking.restaurantId) : null;
  return { booking, restaurant };
}

module.exports = {
  createBooking,
  guestLookup,
  myBookings,
  getBookingDetails,
  restaurantBookings,
  confirm,
  arrived,
  complete,
  cancel,
  noShow
};

