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
      .input('commissionFee', sql.Float, payload.commissionFee ?? null)
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

// Tổng hợp commission theo nhà hàng và khoảng thời gian (dựa trên completedAt)
async function getCommissionSummaryByRestaurant(restaurantId, { from, to } = {}) {
  const pool = await getPool();
  const req = pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId);

  // Tính commission khi booking đã xác nhận trở lên và đã thanh toán cọc
  const eligibleStatuses = ['CONFIRMED', 'ARRIVED', 'COMPLETED'];
  const timeExpr = 'COALESCE(depositPaidAt, completedAt, confirmedAt, createdAt)';

  const where = [
    'restaurantId=@restaurantId',
    `status IN (${eligibleStatuses.map((_, i) => `@st${i}`).join(',')})`,
    'ISNULL(commissionFee, 0) > 0'
  ];

  eligibleStatuses.forEach((s, i) => req.input(`st${i}`, sql.NVarChar(30), s));

  if (from) {
    where.push(`${timeExpr} >= @from`);
    req.input('from', sql.DateTime2, new Date(from));
  }

  if (to) {
    where.push(`${timeExpr} <= @to`);
    req.input('to', sql.DateTime2, new Date(to));
  }

  const rs = await req.query(`
    SELECT
      COUNT(1) AS totalEligibleBookings,
      ISNULL(SUM(CASE WHEN commissionPaid = 1 THEN 1 ELSE 0 END), 0) AS settledBookings,
      ISNULL(SUM(CASE WHEN commissionPaid = 0 THEN 1 ELSE 0 END), 0) AS unsettledBookings,
      ISNULL(SUM(commissionFee), 0) AS totalCommission,
      ISNULL(SUM(CASE WHEN commissionPaid = 1 THEN commissionFee ELSE 0 END), 0) AS settledCommission,
      ISNULL(SUM(CASE WHEN commissionPaid = 0 THEN commissionFee ELSE 0 END), 0) AS unsettledCommission
    FROM dbo.Bookings
    WHERE ${where.join(' AND ')}
  `);

  return rs.recordset[0] || {
    totalEligibleBookings: 0,
    settledBookings: 0,
    unsettledBookings: 0,
    totalCommission: 0,
    settledCommission: 0,
    unsettledCommission: 0
  };
}

// Chốt thu commission: đánh dấu commissionPaid=1 cho các booking đủ điều kiện
async function settleCommissionByRestaurant(restaurantId, { from, to, minAgeMinutes = 0 } = {}) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const req = new sql.Request(tx)
      .input('restaurantId', sql.UniqueIdentifier, restaurantId)
      .input('minAgeMinutes', sql.Int, Number(minAgeMinutes || 0));

    const eligibleStatuses = ['CONFIRMED', 'ARRIVED', 'COMPLETED'];
    const timeExpr = 'COALESCE(depositPaidAt, completedAt, confirmedAt, createdAt)';

    const where = [
      'restaurantId=@restaurantId',
      `status IN (${eligibleStatuses.map((_, i) => `@st${i}`).join(',')})`,
      'commissionPaid=0',
      'ISNULL(commissionFee, 0) > 0',
      `${timeExpr} <= DATEADD(minute, -@minAgeMinutes, SYSUTCDATETIME())`
    ];

    eligibleStatuses.forEach((s, i) => req.input(`st${i}`, sql.NVarChar(30), s));

    if (from) {
      where.push(`${timeExpr} >= @from`);
      req.input('from', sql.DateTime2, new Date(from));
    }

    if (to) {
      where.push(`${timeExpr} <= @to`);
      req.input('to', sql.DateTime2, new Date(to));
    }

    const rs = await req.query(`
      UPDATE dbo.Bookings
      SET commissionPaid = 1,
          updatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.id, INSERTED.commissionFee
      WHERE ${where.join(' AND ')}
    `);

    const affected = rs.recordset || [];
    const totalAmount = affected.reduce((sum, row) => sum + Number(row.commissionFee || 0), 0);

    await tx.commit();
    return {
      affectedCount: affected.length,
      totalAmount,
      bookingIds: affected.map((x) => x.id)
    };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// Lay danh sach booking du dieu kien thu commission de service khac orchestrate.
async function listCommissionCandidates({ from, to, minAgeMinutes = 0, restaurantIds = [] } = {}) {
  const pool = await getPool();
  const req = pool.request()
    .input('minAgeMinutes', sql.Int, Number(minAgeMinutes || 0));

  const where = [
    "status='COMPLETED'",
    'commissionPaid=0',
    'ISNULL(commissionFee, 0) > 0',
    'COALESCE(depositPaidAt, completedAt, confirmedAt, createdAt) <= DATEADD(minute, -@minAgeMinutes, SYSUTCDATETIME())'
  ];

  if (from) {
    where.push('COALESCE(depositPaidAt, completedAt, confirmedAt, createdAt) >= @from');
    req.input('from', sql.DateTime2, new Date(from));
  }

  if (to) {
    where.push('COALESCE(depositPaidAt, completedAt, confirmedAt, createdAt) <= @to');
    req.input('to', sql.DateTime2, new Date(to));
  }

  if (Array.isArray(restaurantIds) && restaurantIds.length) {
    const placeholders = restaurantIds.map((_, i) => `@rid${i}`).join(', ');
    restaurantIds.forEach((id, i) => req.input(`rid${i}`, sql.UniqueIdentifier, id));
    where.push(`restaurantId IN (${placeholders})`);
  }

  const rs = await req.query(`
    SELECT
      id,
      restaurantId,
      bookingCode,
      commissionFee,
      COALESCE(depositPaidAt, completedAt, confirmedAt, createdAt) AS eligibleAt
    FROM dbo.Bookings
    WHERE ${where.join(' AND ')}
    ORDER BY restaurantId, eligibleAt ASC
  `);

  return rs.recordset || [];
}

// Danh dau commissionPaid=1 cho cac booking da charge thanh cong.
async function markCommissionPaidByBookingIds(bookingIds = []) {
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return { affectedCount: 0, bookingIds: [] };
  }

  const pool = await getPool();
  const req = pool.request();
  const placeholders = bookingIds.map((_, i) => `@bid${i}`).join(', ');
  bookingIds.forEach((id, i) => req.input(`bid${i}`, sql.UniqueIdentifier, id));

  const rs = await req.query(`
    UPDATE dbo.Bookings
    SET commissionPaid = 1,
        updatedAt = SYSUTCDATETIME()
    OUTPUT INSERTED.id
    WHERE id IN (${placeholders})
      AND commissionPaid = 0
      AND status = 'COMPLETED'
      AND ISNULL(commissionFee, 0) > 0
  `);

  const affected = rs.recordset || [];
  return {
    affectedCount: affected.length,
    bookingIds: affected.map((x) => x.id)
  };
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

 // Validate cancelledBy GUID (nullable)
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cancelBooking(id, fromStatuses, cancelledBy, cancellationReason) {
  // Validate id GUID
  const bookingId = String(id || '').trim();
  if (!GUID_RE.test(bookingId)) {
    throw new Error('Invalid booking id (GUID required)');
  }
 
  // Normalize reason (<= 500 chars)
  const reason = cancellationReason ? String(cancellationReason).slice(0, 500) : null;

  // cancelledBy now stores role string (e.g., 'CUSTOMER') or null
  let validCancelledBy = null;
  if (cancelledBy) {
    validCancelledBy = String(cancelledBy).trim().slice(0, 50);
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
    .input('cancelledBy', sql.NVarChar(50), validCancelledBy)
    .input('cancellationReason', sql.NVarChar(500), reason);

  // Use a slightly larger NVARCHAR parameter to avoid overflow from unexpected values
  statuses.forEach((s, i) => req.input(`s${i}`, sql.NVarChar(100), s));

  // Log parameters and their lengths/values to help diagnose potential overflow
  try {
    // eslint-disable-next-line no-console
    console.log('[cancelBooking] params:', {
      bookingId,
      cancelledBy: validCancelledBy,
      cancellationReasonLength: reason ? reason.length : 0,
      cancellationReasonSample: reason ? (reason.length > 200 ? reason.slice(0, 200) + '...' : reason) : null,
      statuses
    });
    // eslint-disable-next-line no-console
    statuses.forEach((s, i) => console.log(`[cancelBooking] param s${i} (len=${String(s).length}):`, s));
  } catch (e) {}

  let res;
  try {
    // Perform update without OUTPUT to avoid type conversion issues in some SQL drivers
    // Log the query placeholder list
    // eslint-disable-next-line no-console
    console.log('[cancelBooking] executing UPDATE with placeholders:', placeholders);
    res = await req.query(
      `UPDATE dbo.Bookings
      SET status='CANCELLED',
          cancelledAt=SYSUTCDATETIME(),
          cancelledBy=@cancelledBy,
          cancellationReason=@cancellationReason,
          updatedAt=SYSUTCDATETIME()
      WHERE id=@id AND status IN (${placeholders})`
    );
  } catch (e) {
    // Log error with context
    // eslint-disable-next-line no-console
    console.error('[cancelBooking] SQL error:', e && e.message);
    throw e;
  }

  // Nếu không update được (không tồn tại / sai status) => trả null
  if (!res || !res.rowsAffected || res.rowsAffected[0] === 0) return null;

  // Fetch and return the updated row
  const rs2 = await pool.request()
    .input('id', sql.UniqueIdentifier, bookingId)
    .query(`SELECT TOP 1 * FROM dbo.Bookings WHERE id=@id`);

  return rs2.recordset[0] || null;
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
  getCommissionSummaryByRestaurant,
  settleCommissionByRestaurant,
  listCommissionCandidates,
  markCommissionPaidByBookingIds,
  updateStatus,
  cancelBooking
};
