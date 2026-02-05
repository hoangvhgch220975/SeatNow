const { sql, getPool } = require('../config/db');

const ACTIVE_STATUSES = ['PENDING','CONFIRMED','ARRIVED'];
// Helper để parse JSON với giá trị mặc định
function j(v, def) { try { return v ? JSON.parse(v) : def; } catch { return def; } }

// Hàm lấy thông tin nhà hàng
async function getRestaurant(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT TOP 1 id, ownerId, status, depositEnabled, depositPolicyJson, commissionRate
      FROM dbo.Restaurants
      WHERE id=@id
    `);
  return rs.recordset[0] || null;
}

// Hàm lấy thông tin bàn ăn
async function getTable(tableId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, tableId)
    .query(`SELECT TOP 1 * FROM dbo.Tables WHERE id=@id`);
  return rs.recordset[0] || null;
}

// Hàm tìm booking theo ID
async function findById(id) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`SELECT TOP 1 * FROM dbo.Bookings WHERE id=@id`);
  return rs.recordset[0] || null;
}

// Hàm tìm booking theo mã và số điện thoại khách
async function findByCodeAndGuestPhone(bookingCode, guestPhone) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('bookingCode', sql.NVarChar(30), bookingCode)
    .input('guestPhone', sql.NVarChar(20), guestPhone)
    .query(`SELECT TOP 1 * FROM dbo.Bookings WHERE bookingCode=@bookingCode AND guestPhone=@guestPhone`);
  return rs.recordset[0] || null;
}

// Hàm liệt kê booking theo khách hàng
async function listByCustomer(customerId, { limit = 20, offset = 0 } = {}) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('customerId', sql.UniqueIdentifier, customerId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT *
      FROM dbo.Bookings
      WHERE customerId=@customerId
      ORDER BY createdAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return rs.recordset;
}

// Hàm liệt kê booking theo nhà hàng với các bộ lọc
async function listByRestaurant(restaurantId, { from, to, status, limit = 50, offset = 0 } = {}) {
  const pool = await getPool();
  const req = pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  const where = ['restaurantId=@restaurantId'];
  if (from) { where.push('bookingDate >= @from'); req.input('from', sql.Date, from); }
  if (to) { where.push('bookingDate <= @to'); req.input('to', sql.Date, to); }
  if (status) { where.push('status=@status'); req.input('status', sql.NVarChar(30), status); }

  const rs = await req.query(`
    SELECT *
    FROM dbo.Bookings
    WHERE ${where.join(' AND ')}
    ORDER BY bookingDate DESC, bookingTime DESC, createdAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  return rs.recordset;
}

// Hàm chèn booking mới trong một giao dịch
async function insertBookingTx(payload) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const req = new sql.Request(tx);

    const rs = await req
      .input('bookingCode', sql.NVarChar(30), payload.bookingCode)
      .input('customerId', sql.UniqueIdentifier, payload.customerId || null)
      .input('guestName', sql.NVarChar(100), payload.guestName || null)
      .input('guestPhone', sql.NVarChar(20), payload.guestPhone || null)
      .input('guestEmail', sql.NVarChar(255), payload.guestEmail || null)
      .input('restaurantId', sql.UniqueIdentifier, payload.restaurantId)
      .input('tableId', sql.UniqueIdentifier, payload.tableId)
      .input('bookingDate', sql.Date, payload.bookingDate)
      .input('bookingTime', sql.NVarChar(10), payload.bookingTime)
      .input('numGuests', sql.Int, payload.numGuests)
      .input('status', sql.NVarChar(30), payload.status)
      .input('specialRequests', sql.NVarChar(sql.MAX), payload.specialRequests || null)
      .input('depositRequired', sql.Bit, payload.depositRequired ? 1 : 0)
      .input('depositAmount', sql.Float, payload.depositRequired ? payload.depositAmount : null)
      .input('commissionFee', sql.Float, payload.commissionFee || null)
      .query(`
        INSERT INTO dbo.Bookings (
          bookingCode, customerId, guestName, guestPhone, guestEmail,
          restaurantId, tableId, bookingDate, bookingTime, numGuests,
          status, specialRequests, depositRequired, depositAmount, commissionFee
        )
        OUTPUT INSERTED.*
        VALUES (
          @bookingCode, @customerId, @guestName, @guestPhone, @guestEmail,
          @restaurantId, @tableId, @bookingDate, @bookingTime, @numGuests,
          @status, @specialRequests, @depositRequired, @depositAmount, @commissionFee
        )
      `);

    await tx.commit();
    return rs.recordset[0];
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// Hàm cập nhật trạng thái booking với điều kiện trạng thái hiện tại
async function updateStatus(id, fromStatuses, toStatus, timeField) {
  const pool = await getPool();
  const req = pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('to', sql.NVarChar(30), toStatus);

  fromStatuses.forEach((s, i) => req.input(`f${i}`, sql.NVarChar(30), s));

  const rs = await req.query(`
    UPDATE dbo.Bookings
    SET status=@to,
        ${timeField}=SYSUTCDATETIME(),
        updatedAt=SYSUTCDATETIME()
    OUTPUT INSERTED.*
    WHERE id=@id AND status IN (${fromStatuses.map((_, i) => `@f${i}`).join(',')})
  `);

  return rs.recordset[0] || null;
}

// Cancel booking with reason and cancelledBy (nullable)

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cancelBooking(id, fromStatuses, cancelledBy, cancellationReason) {
  // Validate id GUID
  const bookingId = String(id || '').trim();
  if (!GUID_RE.test(bookingId)) {
    throw new Error('Invalid booking id (GUID required)');
  }

  // Normalize reason (<= 500 chars)
  const reason = cancellationReason ? String(cancellationReason).slice(0, 500) : null;

  // Validate cancelledBy GUID (nullable)
  let validCancelledBy = null;
  if (cancelledBy) {
    const str = String(cancelledBy).trim();
    if (GUID_RE.test(str)) validCancelledBy = str;
  }

  // Use fromStatuses if provided, else default
  const statuses = Array.isArray(fromStatuses) && fromStatuses.length
    ? fromStatuses.map(s => String(s).trim().toUpperCase())
    : ['PENDING', 'CONFIRMED'];

  // Build parameter placeholders safely: @s0, @s1, ...
  const placeholders = statuses.map((_, i) => `@s${i}`).join(', ');

  const pool = await getPool();
  const req = pool.request()
    .input('id', sql.UniqueIdentifier, bookingId)
    .input('cancelledBy', sql.UniqueIdentifier, validCancelledBy)
    .input('cancellationReason', sql.NVarChar(500), reason);

  statuses.forEach((s, i) => req.input(`s${i}`, sql.VarChar(20), s));

  const rs = await req.query(`
    UPDATE dbo.Bookings
    SET status='CANCELLED',
        cancelledAt=SYSUTCDATETIME(),
        cancelledBy=@cancelledBy,
        cancellationReason=@cancellationReason,
        updatedAt=SYSUTCDATETIME()
    OUTPUT INSERTED.*
    WHERE id=@id AND status IN (${placeholders})
  `);

  // Nếu không update được (không tồn tại / sai status) => trả null
  return rs.recordset[0] || null;
}


module.exports = {
  ACTIVE_STATUSES,
  j,
  getRestaurant,
  getTable,
  findById,
  findByCodeAndGuestPhone,
  listByCustomer,
  listByRestaurant,
  insertBookingTx,
  updateStatus,
  cancelBooking
};
