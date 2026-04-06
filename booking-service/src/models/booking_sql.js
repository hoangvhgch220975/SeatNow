const { sql, getPool } = require('../config/db');

const ACTIVE_STATUSES = ['PENDING','CONFIRMED','ARRIVED'];
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidGuid(id) {
  return typeof id === 'string' && GUID_RE.test(id);
}

// Helper để parse JSON với giá trị mặc định
function j(v, def) { try { return v ? JSON.parse(v) : def; } catch { return def; } }

// Hàm lấy thông tin nhà hàng
async function getRestaurant(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT TOP 1 
        r.id, r.ownerId, r.status, r.depositEnabled, r.depositPolicyJson, r.commissionRate,
        r.name as restaurantName, r.address as restaurantAddress,
        u.email as ownerEmail, u.name as ownerName
      FROM dbo.Restaurants r
      LEFT JOIN dbo.Users u ON r.ownerId = u.id
      WHERE r.id=@id
    `);
  return rs.recordset[0] || null;
}

// Hàm lấy thông tin bàn ăn
async function getTable(tableId) {
  if (!isValidGuid(tableId)) return null;
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, tableId)
    .query(`SELECT TOP 1 * FROM dbo.Tables WHERE id=@id`);
  return rs.recordset[0] || null;
}

// Hàm tìm booking theo ID
async function findById(id) {
  if (!isValidGuid(id)) return null;
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`SELECT TOP 1 * FROM dbo.Bookings WHERE id=@id`);
  return rs.recordset[0] || null;
}

// Hàm tìm booking theo mã (Booking Code duy nhất)
async function findByCode(bookingCode) {
  if (!bookingCode) return null;
  const pool = await getPool();
  const rs = await pool.request()
    .input('bookingCode', sql.NVarChar(30), bookingCode)
    .query(`SELECT TOP 1 * FROM dbo.Bookings WHERE bookingCode=@bookingCode`);
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
      .input('depositPaid', sql.Bit, payload.depositPaid ? 1 : 0)
      .input('depositPaidAt', sql.DateTime2, payload.depositPaidAt || null)
      .input('commissionFee', sql.Float, payload.commissionFee ?? null)
      .query(`
        INSERT INTO dbo.Bookings (
          bookingCode, customerId, guestName, guestPhone, guestEmail,
          restaurantId, tableId, bookingDate, bookingTime, numGuests,
          status, specialRequests, depositRequired, depositAmount,
          depositPaid, depositPaidAt, commissionFee
        )
        OUTPUT INSERTED.*
        VALUES (
          @bookingCode, @customerId, @guestName, @guestPhone, @guestEmail,
          @restaurantId, @tableId, @bookingDate, @bookingTime, @numGuests,
          @status, @specialRequests, @depositRequired, @depositAmount,
          @depositPaid, @depositPaidAt, @commissionFee
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

  // Tính commission khi booking đã xác nhận trở lên  
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
    "status IN ('ARRIVED', 'COMPLETED')",
    'commissionPaid=0',
    'ISNULL(commissionFee, 0) > 0',
    'COALESCE(depositPaidAt, arrivedAt, completedAt, confirmedAt, createdAt) <= DATEADD(minute, -@minAgeMinutes, SYSUTCDATETIME())'
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
      COALESCE(depositPaidAt, arrivedAt, completedAt, confirmedAt, createdAt) AS eligibleAt
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
      AND status IN ('ARRIVED', 'COMPLETED')
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
  if (!isValidGuid(id)) return null;
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

async function cancelBooking(bookingId, fromStatuses = null, cancelledBy = null, cancellationReason = null, refund = false) {
  // Validate id GUID
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
    .input('reason', sql.NVarChar(500), reason)
    .input('refund', sql.Bit, refund ? 1 : 0);

  // Use a slightly larger NVARCHAR parameter to avoid overflow from unexpected values
  statuses.forEach((s, i) => req.input(`s${i}`, sql.NVarChar(100), s));


  let res;
  try {
    // Perform update without OUTPUT to avoid type conversion issues in some SQL drivers
    // Log the query placeholder list
    res = await req.query(
      `UPDATE dbo.Bookings
      SET status = 'CANCELLED',
          cancelledAt = SYSDATETIME(),
          cancelledBy = @cancelledBy,
          cancellationReason = @reason,
          depositRefunded = CASE WHEN @refund = 1 THEN 1 ELSE depositRefunded END,
          updatedAt = SYSDATETIME()
      OUTPUT inserted.*
      WHERE id = @id AND status IN (${placeholders})`
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

// Thống kê Portfolio cho Chủ sở hữu chuỗi nhà hàng (Global + Breakdown)
async function getOwnerPortfolioSummary(ownerId, { from, to } = {}) {
  const pool = await getPool();
  
  let dateFilter = '';
  if (from && to) {
    dateFilter = "AND b.bookingDate BETWEEN @from AND @to";
  } else if (from) {
    dateFilter = "AND b.bookingDate >= @from";
  } else if (to) {
    dateFilter = "AND b.bookingDate <= @to";
  }

  // 1. Lấy dữ liệu tổng quan
  const reqGlobal = pool.request().input('ownerId', sql.UniqueIdentifier, ownerId);
  if (from) reqGlobal.input('from', sql.Date, from);
  if (to) reqGlobal.input('to', sql.Date, to);

  const rsGlobal = await reqGlobal.query(`
    SELECT
      COUNT(b.id) AS totalBookings,
      ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN b.depositAmount - ISNULL(b.commissionFee, 0) ELSE 0 END), 0) AS totalRevenue,
      ISNULL(SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS totalCancelled,
      ISNULL(SUM(CASE WHEN b.status = 'NO_SHOW' THEN 1 ELSE 0 END), 0) AS totalNoShow,
      ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN b.depositAmount ELSE 0 END), 0) AS totalGrossRevenue,
      SUM(CASE WHEN b.numGuests = 2 THEN 1 ELSE 0 END) AS countCouple,
      SUM(CASE WHEN b.numGuests BETWEEN 4 AND 6 THEN 1 ELSE 0 END) AS countSmallGroup,
      SUM(CASE WHEN b.numGuests >= 8 THEN 1 ELSE 0 END) AS countParty,
      COUNT(DISTINCT r.id) AS totalRestaurants,
      -- Sử dụng subquery để tính toán cho từng chủ sở hữu độc lập với phép JOIN Bookings
      (SELECT ISNULL(SUM(r2.ratingCount), 0) FROM dbo.Restaurants r2 WHERE r2.ownerId = @ownerId) AS portfolioTotalReviews,
      (SELECT ISNULL(SUM(r2.ratingAvg * r2.ratingCount) / NULLIF(SUM(r2.ratingCount), 0), 0) FROM dbo.Restaurants r2 WHERE r2.ownerId = @ownerId) AS portfolioRatingAvg
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Bookings b ON r.id = b.restaurantId ${dateFilter}
    WHERE r.ownerId = @ownerId
  `);

  // 2. Lấy dữ liệu chi tiết từng nhà hàng (Breakdown)
  const reqBreakdown = pool.request().input('ownerId', sql.UniqueIdentifier, ownerId);
  if (from) reqBreakdown.input('from', sql.Date, from);
  if (to) reqBreakdown.input('to', sql.Date, to);

  const rsBreakdown = await reqBreakdown.query(`
    SELECT
      r.id,
      r.name,
      r.status as restaurantStatus,
      COUNT(b.id) AS totalBookings,
      ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN b.depositAmount - ISNULL(b.commissionFee, 0) ELSE 0 END), 0) AS totalRevenue,
      ISNULL(SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS totalCancelled,
      ISNULL(SUM(CASE WHEN b.status = 'NO_SHOW' THEN 1 ELSE 0 END), 0) AS totalNoShow,
      ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN b.depositAmount ELSE 0 END), 0) AS totalGrossRevenue,
      SUM(CASE WHEN b.numGuests = 2 THEN 1 ELSE 0 END) AS countCouple,
      SUM(CASE WHEN b.numGuests BETWEEN 4 AND 6 THEN 1 ELSE 0 END) AS countSmallGroup,
      SUM(CASE WHEN b.numGuests >= 8 THEN 1 ELSE 0 END) AS countParty
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Bookings b ON r.id = b.restaurantId ${dateFilter}
    WHERE r.ownerId = @ownerId
    GROUP BY r.id, r.name, r.status
  `);

  const globalStats = rsGlobal.recordset[0] || {};
  const totalBookings = Number(globalStats.totalBookings || 0);
  const totalCancelled = Number(globalStats.totalCancelled || 0);
  const totalNoShow = Number(globalStats.totalNoShow || 0);
  const globalCancellationRate = totalBookings > 0 ? ((totalCancelled + totalNoShow) / totalBookings) : 0;

  const breakdown = rsBreakdown.recordset.map(row => {
    const bTotal = Number(row.totalBookings || 0);
    const bCancelled = Number(row.totalCancelled || 0);
    const bNoShow = Number(row.totalNoShow || 0);
    const bRate = bTotal > 0 ? ((bCancelled + bNoShow) / bTotal) : 0;

    return {
      restaurantId: row.id,
      restaurantName: row.name,
      restaurantStatus: row.restaurantStatus,
      totalBookings: bTotal,
      totalRevenue: Number(row.totalRevenue || 0),
      totalGrossRevenue: Number(row.totalGrossRevenue || 0),
      totalCancelled: bCancelled,
      totalNoShow: bNoShow,
      cancellationRate: parseFloat(bRate.toFixed(4)),
      guestSizeCounts: {
        couple: Number(row.countCouple || 0),
        smallGroup: Number(row.countSmallGroup || 0),
        party: Number(row.countParty || 0)
      }
    };
  });

  return {
    summary: {
      totalRestaurants: Number(globalStats.totalRestaurants || 0),
      totalBookings,
      totalRevenue: Number(globalStats.totalRevenue || 0),
      totalGrossRevenue: Number(globalStats.totalGrossRevenue || 0),
      totalCancelled,
      totalNoShow,
      cancellationRate: parseFloat(globalCancellationRate.toFixed(4)),
      portfolioTotalReviews: Number(globalStats.portfolioTotalReviews || 0),
      portfolioRatingAvg: parseFloat(Number(globalStats.portfolioRatingAvg || 0).toFixed(2)),
      guestSizeCounts: {
        couple: Number(globalStats.countCouple || 0),
        smallGroup: Number(globalStats.countSmallGroup || 0),
        party: Number(globalStats.countParty || 0)
      }
    },
    breakdown
  };
}

// Thống kê Summary cho DUY NHẤT một nhà hàng (không theo period)
async function getRestaurantStatsSummary(restaurantId, { from, to } = {}) {
  const pool = await getPool();
  
  let dateFilter = '';
  if (from && to) {
    dateFilter = "AND bookingDate BETWEEN @from AND @to";
  } else if (from) {
    dateFilter = "AND bookingDate >= @from";
  } else if (to) {
    dateFilter = "AND bookingDate <= @to";
  }

  const req = pool.request().input('restaurantId', sql.UniqueIdentifier, restaurantId);
  if (from) req.input('from', sql.Date, from);
  if (to) req.input('to', sql.Date, to);

  const rs = await req.query(`
    SELECT
      COUNT(id) AS totalBookings,
      ISNULL(SUM(CASE WHEN depositPaid = 1 AND ISNULL(depositRefunded, 0) = 0 THEN depositAmount - ISNULL(commissionFee, 0) ELSE 0 END), 0) AS totalRevenue,
      ISNULL(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS totalCancelled,
      ISNULL(SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END), 0) AS totalNoShow,
      ISNULL(SUM(CASE WHEN depositPaid = 1 AND ISNULL(depositRefunded, 0) = 0 THEN depositAmount ELSE 0 END), 0) AS totalGrossRevenue,
      SUM(CASE WHEN numGuests = 2 THEN 1 ELSE 0 END) AS countCouple,
      SUM(CASE WHEN numGuests BETWEEN 4 AND 6 THEN 1 ELSE 0 END) AS countSmallGroup,
      SUM(CASE WHEN numGuests >= 8 THEN 1 ELSE 0 END) AS countParty
    FROM dbo.Bookings
    WHERE restaurantId = @restaurantId ${dateFilter}
  `);

  const stats = rs.recordset[0] || {};
  const totalBookings = Number(stats.totalBookings || 0);
  const totalCancelled = Number(stats.totalCancelled || 0);
  const totalNoShow = Number(stats.totalNoShow || 0);
  const cancellationRate = totalBookings > 0 ? ((totalCancelled + totalNoShow) / totalBookings) : 0;

  return {
    restaurantId,
    totalBookings,
    totalRevenue: Number(stats.totalRevenue || 0),
    totalGrossRevenue: Number(stats.totalGrossRevenue || 0),
    totalCancelled,
    totalNoShow,
    cancellationRate: parseFloat(cancellationRate.toFixed(4)),
    guestSizeCounts: {
      couple: Number(stats.countCouple || 0),
      smallGroup: Number(stats.countSmallGroup || 0),
      party: Number(stats.countParty || 0)
    }
  };
}

// Thống kê doanh thu cho MỘT nhà hàng theo thời gian (giống admin-service nhưng quy mô 1 restaurant)
async function getRevenueStatistics(restaurantId, { period = 'month', from, to } = {}) {
  const pool = await getPool();
  const req = pool.request().input('restaurantId', sql.UniqueIdentifier, restaurantId);

  let periodExpr = "FORMAT(bookingDate, 'yyyy-MM-dd')"; // default: day
  if (period === 'hour') {
    // Group 2-hour buckets: 00:00, 02:00, ..., 22:00
    periodExpr = "RIGHT('0' + CAST(FLOOR(CAST(LEFT(bookingTime, 2) AS INT) / 2) * 2 AS VARCHAR(2)), 2) + ':00'";
  } else if (period === 'day') {
    periodExpr = "FORMAT(bookingDate, 'yyyy-MM-dd')";
  } else if (period === 'week') {
    // Week of month (1, 2, 3, 4)
    periodExpr = "CONCAT('Week ', (DATEPART(day, bookingDate) - 1) / 7 + 1)";
  } else if (period === 'month') {
    periodExpr = "FORMAT(bookingDate, 'yyyy-MM')";
  } else if (period === 'quarter') {
    periodExpr = "CONCAT(YEAR(bookingDate), '-Q', DATEPART(quarter, bookingDate))";
  } else if (period === 'year') {
    periodExpr = "FORMAT(bookingDate, 'yyyy')";
  }

  const where = [
    'restaurantId = @restaurantId',
    'depositPaid = 1',
    'ISNULL(depositRefunded, 0) = 0'
  ];

  if (from) {
    where.push('bookingDate >= @from');
    req.input('from', sql.Date, from);
  }
  if (to) {
    where.push('bookingDate <= @to');
    req.input('to', sql.Date, to);
  }

  let query = '';

  if (period === 'hour') {
    query = `
      WITH Hours AS (
        SELECT 0 AS h UNION ALL SELECT h + 2 FROM Hours WHERE h < 22
      )
      SELECT 
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM Hours
      LEFT JOIN (
        SELECT b.* FROM dbo.Bookings b
        WHERE b.restaurantId = @restaurantId
          AND b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
          ${from ? 'AND b.bookingDate >= @from' : ''}
          ${to ? 'AND b.bookingDate <= @to' : ''}
      ) b ON FLOOR(CAST(LEFT(b.bookingTime, 2) AS INT) / 2) * 2 = Hours.h
      GROUP BY h
      ORDER BY h ASC
    `;
  } else if (period === 'day') {
    query = `
      WITH DateCTE AS (
        SELECT CAST(@from AS DATE) AS d
        UNION ALL
        SELECT DATEADD(day, 1, d) FROM DateCTE WHERE d < CAST(@to AS DATE)
      )
      SELECT 
        FORMAT(DateCTE.d, 'yyyy-MM-dd') AS timePeriod,
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM DateCTE
      LEFT JOIN (
        SELECT b.* FROM dbo.Bookings b
        WHERE b.restaurantId = @restaurantId
          AND b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
      ) b ON CAST(b.bookingDate AS DATE) = DateCTE.d
      GROUP BY DateCTE.d
      ORDER BY DateCTE.d ASC
    `;
  } else if (period === 'week') {
    query = `
      WITH WeekCTE AS (
        SELECT 1 AS w UNION ALL SELECT w + 1 FROM WeekCTE WHERE w < 5
      )
      SELECT 
        CONCAT('Week ', WeekCTE.w) AS timePeriod,
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM WeekCTE
      LEFT JOIN (
        SELECT b.* FROM dbo.Bookings b
        WHERE b.restaurantId = @restaurantId
          AND b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
          ${from ? 'AND b.bookingDate >= @from' : ''}
          ${to ? 'AND b.bookingDate <= @to' : ''}
      ) b ON (DATEPART(day, b.bookingDate) - 1) / 7 + 1 = WeekCTE.w
      GROUP BY WeekCTE.w
      ORDER BY WeekCTE.w ASC
    `;
  } else {
    query = `
      SELECT
        ${periodExpr} AS timePeriod,
        COUNT(CASE WHEN status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN id END) AS totalBookings,
        COUNT(CASE WHEN status = 'CANCELLED' THEN id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN depositPaid = 1 AND ISNULL(depositRefunded, 0) = 0 THEN ISNULL(depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN depositPaid = 1 AND ISNULL(depositRefunded, 0) = 0 THEN ISNULL(depositAmount, 0) - ISNULL(commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN depositPaid = 1 AND ISNULL(depositRefunded, 0) = 0 THEN ISNULL(depositAmount, 0) - ISNULL(commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN numGuests END), 0) AS totalGuests
      FROM dbo.Bookings
      WHERE restaurantId = @restaurantId AND status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
      GROUP BY ${periodExpr}
      ORDER BY timePeriod ASC
    `;
  }

  const rs = await req.query(query);
  return rs.recordset || [];
}

// Thống kê phân bổ giờ đặt bàn cho MỘT nhà hàng
async function getHourlyBookingStats(restaurantId, { from, to } = {}) {
  const pool = await getPool();
  const req = pool.request().input('restaurantId', sql.UniqueIdentifier, restaurantId);

  const where = [
    'restaurantId = @restaurantId'
  ];

  if (from) {
    where.push('bookingDate >= @from');
    req.input('from', sql.Date, from);
  }
  if (to) {
    where.push('bookingDate <= @to');
    req.input('to', sql.Date, to);
  }

  const query = `
    WITH Hours AS (
      SELECT 0 AS h UNION ALL SELECT h + 2 FROM Hours WHERE h < 22
    )
    SELECT 
      RIGHT('0' + CAST(h AS VARCHAR(2)), 2) + ':00' AS hour,
      COUNT(b.id) AS count
    FROM Hours
    LEFT JOIN dbo.Bookings b ON FLOOR(CAST(LEFT(b.bookingTime, 2) AS INT) / 2) * 2 = Hours.h
      AND b.restaurantId = @restaurantId
      ${from ? 'AND b.bookingDate >= @from' : ''}
      ${to ? 'AND b.bookingDate <= @to' : ''}
    GROUP BY h
    ORDER BY h ASC
  `;

  const rs = await req.query(query);
  return rs.recordset || [];
}

// Thống kê phân bổ giờ đặt bàn Portfolio (toàn bộ nhà hàng của một owner)
async function getOwnerHourlyBookingStats(ownerId, { from, to } = {}) {
  const pool = await getPool();
  const req = pool.request().input('ownerId', sql.UniqueIdentifier, ownerId);

  const where = [
    'r.ownerId = @ownerId'
  ];

  if (from) {
    where.push('b.bookingDate >= @from');
    req.input('from', sql.Date, from);
  }
  if (to) {
    where.push('b.bookingDate <= @to');
    req.input('to', sql.Date, to);
  }

  const query = `
    WITH Hours AS (
      SELECT 0 AS h UNION ALL SELECT h + 2 FROM Hours WHERE h < 22
    )
    SELECT 
      RIGHT('0' + CAST(h AS VARCHAR(2)), 2) + ':00' AS hour,
      COUNT(b.id) AS count
    FROM Hours
    LEFT JOIN dbo.Bookings b ON FLOOR(CAST(LEFT(b.bookingTime, 2) AS INT) / 2) * 2 = Hours.h
      INNER JOIN dbo.Restaurants r ON b.restaurantId = r.id AND r.ownerId = @ownerId
      ${from ? 'AND b.bookingDate >= @from' : ''}
      ${to ? 'AND b.bookingDate <= @to' : ''}
    GROUP BY h
    ORDER BY h ASC
  `;

  const rs = await req.query(query);
  return rs.recordset || [];
}

// Thống kê doanh thu và đơn đặt bàn Portfolio (toàn bộ nhà hàng của một owner) theo thời gian (Timeline)
async function getOwnerRevenueStatistics(ownerId, { period = 'month', from, to } = {}) {
  const pool = await getPool();
  const req = pool.request().input('ownerId', sql.UniqueIdentifier, ownerId);

  let periodExpr = "FORMAT(bookingDate, 'yyyy-MM-dd')"; // default: day
  if (period === 'hour') {
    periodExpr = "RIGHT('0' + CAST(FLOOR(CAST(LEFT(bookingTime, 2) AS INT) / 2) * 2 AS VARCHAR(2)), 2) + ':00'";
  } else if (period === 'day') {
    periodExpr = "FORMAT(bookingDate, 'yyyy-MM-dd')";
  } else if (period === 'week') {
    // Week of month (1, 2, 3, 4)
    periodExpr = "CONCAT('Week ', (DATEPART(day, bookingDate) - 1) / 7 + 1)";
  } else if (period === 'month') {
    periodExpr = "FORMAT(bookingDate, 'yyyy-MM')";
  } else if (period === 'quarter') {
    periodExpr = "CONCAT(YEAR(bookingDate), '-Q', DATEPART(quarter, bookingDate))";
  } else if (period === 'year') {
    periodExpr = "FORMAT(bookingDate, 'yyyy')";
  }

  const where = [
    'r.ownerId = @ownerId',
    'b.depositPaid = 1',
    'ISNULL(b.depositRefunded, 0) = 0'
  ];

  if (from) {
    where.push('b.bookingDate >= @from');
    req.input('from', sql.Date, from);
  }
  if (to) {
    where.push('b.bookingDate <= @to');
    req.input('to', sql.Date, to);
  }

  let query = '';

  if (period === 'hour') {
    query = `
      WITH Hours AS (
        SELECT 0 AS h UNION ALL SELECT h + 2 FROM Hours WHERE h < 22
      )
      SELECT 
        RIGHT('0' + CAST(h AS VARCHAR(2)), 2) + ':00' AS timePeriod,
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM Hours
      LEFT JOIN (
        SELECT b.* FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON b.restaurantId = r.id AND r.ownerId = @ownerId
        WHERE b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
          ${from ? 'AND b.bookingDate >= @from' : ''}
          ${to ? 'AND b.bookingDate <= @to' : ''}
      ) b ON FLOOR(CAST(LEFT(b.bookingTime, 2) AS INT) / 2) * 2 = Hours.h
      GROUP BY h
      ORDER BY h ASC
    `;
  } else if (period === 'day') {
    query = `
      WITH DateCTE AS (
        SELECT CAST(@from AS DATE) AS d
        UNION ALL
        SELECT DATEADD(day, 1, d) FROM DateCTE WHERE d < CAST(@to AS DATE)
      )
      SELECT 
        FORMAT(DateCTE.d, 'yyyy-MM-dd') AS timePeriod,
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM DateCTE
      LEFT JOIN (
        SELECT b.* 
        FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON b.restaurantId = r.id AND r.ownerId = @ownerId
        WHERE b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
      ) b ON CAST(b.bookingDate AS DATE) = DateCTE.d
      GROUP BY DateCTE.d
      ORDER BY DateCTE.d ASC
    `;
  } else if (period === 'week') {
    query = `
      WITH WeekCTE AS (
        SELECT 1 AS w UNION ALL SELECT w + 1 FROM WeekCTE WHERE w < 5
      )
      SELECT 
        CONCAT('Week ', WeekCTE.w) AS timePeriod,
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM WeekCTE
      LEFT JOIN (
        SELECT b.* 
        FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON b.restaurantId = r.id AND r.ownerId = @ownerId
        WHERE b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
          AND ISNULL(b.depositRefunded, 0) = 0
          ${from ? 'AND b.bookingDate >= @from' : ''}
          ${to ? 'AND b.bookingDate <= @to' : ''}
      ) b ON (DATEPART(day, b.bookingDate) - 1) / 7 + 1 = WeekCTE.w
      GROUP BY WeekCTE.w
      ORDER BY WeekCTE.w ASC
    `;
  } else {
    query = `
      SELECT
        ${periodExpr} AS timePeriod,
        COUNT(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.id END) AS totalBookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN b.id END) AS totalCancelled,
        ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) END), 0) AS totalGrossRevenue,
        CASE WHEN ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) < 0 THEN 0 
             ELSE ISNULL(SUM(CASE WHEN b.depositPaid = 1 AND ISNULL(b.depositRefunded, 0) = 0 THEN ISNULL(b.depositAmount, 0) - ISNULL(b.commissionFee, 0) END), 0) END AS totalRevenue,
        ISNULL(SUM(CASE WHEN b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED') THEN b.numGuests END), 0) AS totalGuests
      FROM dbo.Bookings b
      JOIN dbo.Restaurants r ON b.restaurantId = r.id
      WHERE r.ownerId = @ownerId AND b.status IN ('COMPLETED', 'ARRIVED', 'CONFIRMED', 'CANCELLED')
      GROUP BY ${periodExpr}
      ORDER BY timePeriod ASC
    `;
  }

  const rs = await req.query(query);
  return rs.recordset || [];
}

async function incrementUserLoyaltyPoints(userId, points) {
  const pool = await getPool();
  return pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .input('points', sql.Int, points)
    .query(`
      UPDATE dbo.Users
      SET loyaltyPoints = ISNULL(loyaltyPoints, 0) + @points,
          updatedAt = SYSUTCDATETIME()
      WHERE id = @userId
    `);
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
  cancelBooking,
  getOwnerPortfolioSummary,
  getRestaurantStatsSummary,
  getRevenueStatistics,
  getHourlyBookingStats,
  getOwnerHourlyBookingStats,
  getOwnerRevenueStatistics,
  isValidGuid,
  findByCode,
  incrementUserLoyaltyPoints
};
