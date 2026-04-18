const { sql, getPool } = require('../config/sql');

// Tinh offset/limit an toan cho truy van phan trang.
function buildPagination(page, limit) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit
  };
}

// Lay so lieu tong quan cho dashboard admin, hỗ trợ lọc theo thời gian và nhà hàng.
async function getDashboardStats({ dateFrom, dateTo, restaurantId } = {}) {
  const pool = await getPool();
  const req = pool.request();

  let dateFilterBookings = '';
  let dateFilterTransactions = '';
  let dateFilterUsers = '';
  let dateFilterRestaurants = '';
  let restaurantFilterBookings = '';
  let restaurantFilterTransactions = '';

  if (restaurantId && restaurantId !== 'all') {
    req.input('rid', sql.UniqueIdentifier, restaurantId);
    restaurantFilterBookings = ' AND restaurantId = @rid';
    restaurantFilterTransactions = ' AND w.restaurantId = @rid';
  }

  if (dateFrom) {
    req.input('df', sql.DateTime, dateFrom);
    dateFilterBookings += ' AND bookingDate >= @df';
    dateFilterTransactions += ' AND t.createdAt >= @df';
    dateFilterUsers += ' AND createdAt >= @df';
    dateFilterRestaurants += ' AND createdAt >= @df';
  }
  if (dateTo) {
    req.input('dt', sql.DateTime, dateTo);
    dateFilterBookings += ' AND bookingDate <= @dt';
    dateFilterTransactions += ' AND t.createdAt <= @dt';
    dateFilterUsers += ' AND createdAt <= @dt';
    dateFilterRestaurants += ' AND createdAt <= @dt';
  }

  const rs = await req.query(`
    SELECT
      -- Global Stats (Snapshot)
      (SELECT COUNT(1) FROM dbo.Users) AS totalUsers,
      (SELECT COUNT(1) FROM dbo.Restaurants) AS totalRestaurants,
      (SELECT COUNT(1) FROM dbo.Restaurants WHERE LOWER(ISNULL(status, '')) = 'pending') AS pendingRestaurants,
      (SELECT COUNT(1) FROM dbo.Restaurants WHERE LOWER(ISNULL(status, '')) = 'active') AS activeRestaurants,
      (SELECT COUNT(1) FROM dbo.Restaurants WHERE LOWER(ISNULL(status, '')) = 'suspended') AS suspendedRestaurants,
      (SELECT ISNULL(SUM(balance), 0) FROM dbo.Wallets) AS totalWalletBalance,

      -- Periodic Stats (Filtered)
      (SELECT COUNT(1) FROM dbo.Users WHERE 1=1 ${dateFilterUsers}) AS newUsers,
      (SELECT COUNT(1) FROM dbo.Users WHERE role = 'RESTAURANT_OWNER' ${dateFilterUsers}) AS newOwners,
      (SELECT COUNT(1) FROM dbo.Restaurants WHERE LOWER(ISNULL(status, '')) = 'active' ${dateFilterRestaurants}) AS newActiveRestaurants,
      
      (SELECT COUNT(1) FROM dbo.Bookings WHERE 1=1 ${dateFilterBookings} ${restaurantFilterBookings}) AS totalBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'PENDING' ${dateFilterBookings} ${restaurantFilterBookings}) AS pendingBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'CONFIRMED' ${dateFilterBookings} ${restaurantFilterBookings}) AS confirmedBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'COMPLETED' ${dateFilterBookings} ${restaurantFilterBookings}) AS completedBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) IN ('CANCELLED', 'NO_SHOW') ${dateFilterBookings} ${restaurantFilterBookings}) AS cancelledBookings,
      
      (SELECT ISNULL(SUM(amount), 0) FROM dbo.Transactions t LEFT JOIN dbo.Wallets w ON w.id = t.walletId WHERE t.walletId = '6EDEC0B0-EA2C-46CB-B940-C8A1A357A0C9' AND t.status = 'COMPLETED' ${dateFilterTransactions} ${restaurantFilterTransactions}) AS totalCommission,
      (SELECT ISNULL(SUM(depositAmount), 0) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) IN ('ARRIVED', 'COMPLETED', 'NO_SHOW', 'CONFIRMED') ${dateFilterBookings} ${restaurantFilterBookings}) AS totalDeposit,

      (SELECT COUNT(1) FROM dbo.Transactions t LEFT JOIN dbo.Wallets w ON w.id = t.walletId WHERE 1=1 ${dateFilterTransactions} ${restaurantFilterTransactions}) AS totalTransactions,
      (SELECT COUNT(1) FROM dbo.Transactions t LEFT JOIN dbo.Wallets w ON w.id = t.walletId WHERE UPPER(ISNULL(type, '')) = 'DEPOSIT_PAYMENT' ${dateFilterTransactions} ${restaurantFilterTransactions}) AS totalDepositTransactions
  `);

  return rs.recordset[0] || {};
}

// Lay danh sach nha hang dang o trang thai pending.
async function getPendingRestaurants() {
  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT
      r.*,
      u.name AS ownerName,
      u.email AS ownerEmail,
      u.phone AS ownerPhone
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Users u ON u.id = r.ownerId
    WHERE LOWER(ISNULL(r.status, '')) = 'pending'
    ORDER BY r.createdAt DESC
  `);

  return (rs.recordset || []).map(r => {
    try {
      r.cuisineTypes = r.cuisineTypeJson ? JSON.parse(r.cuisineTypeJson) : [];
      r.images = r.imagesJson ? JSON.parse(r.imagesJson) : [];
    } catch (e) {}
    return r;
  });
}

// Lay thong tin nha hang theo id de phuc vu duyet/tam ngung.
async function getRestaurantById(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT TOP 1 id, ownerId, name, status, createdAt, updatedAt
      FROM dbo.Restaurants
      WHERE id = @restaurantId
    `);

  return rs.recordset[0] || null;
}

// Lay thong tin auth toi thieu cua user tu DB.
async function getUserAuthById(userId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`
      SELECT TOP 1 id, name AS fullName, email, role, CAST(0 AS bit) AS isDeleted
      FROM dbo.Users
      WHERE id = @userId
    `);

  return rs.recordset[0] || null;
}

// Lay danh sach nha hang voi bo loc admin, ho tro tim kiem va thong tin chu so huu.
async function getRestaurants({ q, status, ownerId, page = 1, limit = 20, sort = 'createdAt' } = {}) {
  const pool = await getPool();
  const { offset, page: safePage, limit: safeLimit } = buildPagination(page, limit);
  const req = pool.request()
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, safeLimit);

  const where = ['1=1'];
  if (status && status !== 'all') {
    where.push('r.status = @status');
    req.input('status', sql.NVarChar(30), status);
  }
  if (ownerId) {
    where.push('r.ownerId = @ownerId');
    req.input('ownerId', sql.UniqueIdentifier, ownerId);
  }
  if (q) {
    where.push('(r.name LIKE @q OR u.name LIKE @q OR u.email LIKE @q)');
    req.input('q', sql.NVarChar(255), `%${q}%`);
  }

  let orderBy = 'r.createdAt DESC';
  if (sort === 'name') {
    orderBy = 'r.name ASC';
  }

  const itemsRs = await req.query(`
    SELECT
      r.*,
      u.name AS ownerName,
      u.email AS ownerEmail,
      u.phone AS ownerPhone
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Users u ON u.id = r.ownerId
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countReq = pool.request();
  if (status && status !== 'all') countReq.input('status', sql.NVarChar(30), status);
  if (ownerId) countReq.input('ownerId', sql.UniqueIdentifier, ownerId);
  if (q) countReq.input('q', sql.NVarChar(255), `%${q}%`);

  const countRs = await countReq.query(`
    SELECT COUNT(1) AS total
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Users u ON u.id = r.ownerId
    WHERE ${where.join(' AND ')}
  `);

  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    data: (itemsRs.recordset || []).map(r => {
      // Tu dong parse tat ca cac truong JSON de FE su dung giong het Restaurant Service
      try {
        r.cuisineTypes = r.cuisineTypeJson ? JSON.parse(r.cuisineTypeJson) : [];
        r.images = r.imagesJson ? JSON.parse(r.imagesJson) : [];
        r.openingHours = r.openingHoursJson ? JSON.parse(r.openingHoursJson) : {};
        r.depositPolicy = r.depositPolicyJson ? JSON.parse(r.depositPolicyJson) : {};
      } catch (e) {
        console.warn(`Failed to parse JSON for restaurant ${r.id}:`, e.message);
      }
      return r;
    }),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: total,
      totalPages: totalPages
    }
  };
}

// Doi trang thai nha hang sang active.
async function approveRestaurant(restaurantId) {
  const pool = await getPool();
  await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      UPDATE dbo.Restaurants
      SET status = 'active',
          suspendedBy = NULL,
          updatedAt = SYSUTCDATETIME()
      WHERE id = @restaurantId
    `);
}

// Doi trang thai nha hang sang suspended.
async function suspendRestaurant(restaurantId) {
  const pool = await getPool();
  await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      UPDATE dbo.Restaurants
      SET status = 'suspended',
          suspendedBy = 'ADMIN',
          updatedAt = SYSUTCDATETIME()
      WHERE id = @restaurantId
    `);
}

// Xoa cung nha hang (Dung khi Admin reject ho so pending).
async function hardDeleteRestaurant(restaurantId) {
  const pool = await getPool();
  // Xoa cac bang lien quan truoc (Tables)
  await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query('DELETE FROM dbo.Tables WHERE restaurantId = @restaurantId');

  // Xoa nha hang
  await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query('DELETE FROM dbo.Restaurants WHERE id = @restaurantId');
}

// Tao wallet cho nha hang neu chua ton tai.
async function ensureRestaurantWallet(restaurantId, ownerId) {
  const pool = await getPool();

  const existing = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Wallets
      WHERE restaurantId = @restaurantId
    `);

  if (existing.recordset[0]) return existing.recordset[0];

  const created = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('ownerId', sql.UniqueIdentifier, ownerId)
    .query(`
      INSERT INTO dbo.Wallets (
        id, userId, restaurantId, balance, lockedAmount,
        currency, status, createdAt, updatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        NEWID(), @ownerId, @restaurantId, 0, 0,
        'VND', 'active', SYSUTCDATETIME(), SYSUTCDATETIME()
      )
    `);

  return created.recordset[0] || null;
}

// Lay danh sach user theo role, keyword va phan trang.
async function getUsers({ role, keyword, page = 1, limit = 20 } = {}) {
  const pool = await getPool();
  const { offset, page: safePage, limit: safeLimit } = buildPagination(page, limit);
  const req = pool.request()
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, safeLimit);

  const where = ['1=1'];
  if (role) {
    where.push('role = @role');
    req.input('role', sql.NVarChar(30), role);
  }
  if (keyword) {
    where.push('(name LIKE @keyword OR email LIKE @keyword OR phone LIKE @keyword)');
    req.input('keyword', sql.NVarChar(255), `%${keyword}%`);
  }

  const itemsRs = await req.query(`
    SELECT
      id,
      name AS fullName,
      email,
      phone,
      role,
      avatar,
      CAST(0 AS bit) AS isDeleted,
      createdAt,
      updatedAt
    FROM dbo.Users
    WHERE ${where.join(' AND ')}
    ORDER BY createdAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countReq = pool.request();
  if (role) countReq.input('role', sql.NVarChar(30), role);
  if (keyword) countReq.input('keyword', sql.NVarChar(255), `%${keyword}%`);
  const countRs = await countReq.query(`
    SELECT COUNT(1) AS total
    FROM dbo.Users
    WHERE ${where.join(' AND ')}
  `);

  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    data: itemsRs.recordset || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: total,
      totalPages: totalPages
    }
  };
}

// Lay danh sach booking theo bo loc admin.
async function getBookings({ status, restaurantId, dateFrom, dateTo, page = 1, limit = 20 } = {}) {
  const pool = await getPool();
  const { offset, page: safePage, limit: safeLimit } = buildPagination(page, limit);
  const req = pool.request()
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, safeLimit);

  const where = ['1=1'];
  if (status) {
    where.push('b.status = @status');
    req.input('status', sql.NVarChar(30), status);
  }
  if (restaurantId) {
    where.push('b.restaurantId = @restaurantId');
    req.input('restaurantId', sql.UniqueIdentifier, restaurantId);
  }
  if (dateFrom) {
    where.push('b.createdAt >= @dateFrom');
    req.input('dateFrom', sql.DateTime2, new Date(dateFrom));
  }
  if (dateTo) {
    where.push('b.createdAt <= @dateTo');
    req.input('dateTo', sql.DateTime2, new Date(dateTo));
  }

  const itemsRs = await req.query(`
    SELECT
      b.id,
      b.bookingCode,
      b.customerId,
      b.guestName,
      b.guestPhone,
      b.restaurantId,
      b.tableId,
      b.bookingDate,
      b.bookingTime,
      b.numGuests,
      b.status,
      b.depositRequired,
      b.depositAmount,
      b.depositPaid,
      b.commissionFee,
      b.commissionPaid,
      b.createdAt,
      b.updatedAt,
      r.name AS restaurantName,
      u.name AS customerName
    FROM dbo.Bookings b
    LEFT JOIN dbo.Restaurants r ON r.id = b.restaurantId
    LEFT JOIN dbo.Users u ON u.id = b.customerId
    WHERE ${where.join(' AND ')}
    ORDER BY b.createdAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countReq = pool.request();
  if (status) countReq.input('status', sql.NVarChar(30), status);
  if (restaurantId) countReq.input('restaurantId', sql.UniqueIdentifier, restaurantId);
  if (dateFrom) countReq.input('dateFrom', sql.DateTime2, new Date(dateFrom));
  if (dateTo) countReq.input('dateTo', sql.DateTime2, new Date(dateTo));
  const countRs = await countReq.query(`
    SELECT COUNT(1) AS total
    FROM dbo.Bookings b
    WHERE ${where.join(' AND ')}
  `);

  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    data: itemsRs.recordset || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: total,
      totalPages: totalPages
    }
  };
}

// Lay danh sach giao dich kem thong tin wallet/nha hang.
async function getTransactions({ type, status, provider, restaurantId, walletId, page = 1, limit = 20 } = {}) {
  const pool = await getPool();
  const { offset, page: safePage, limit: safeLimit } = buildPagination(page, limit);
  const req = pool.request()
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, safeLimit);

  const where = ['1=1'];
  if (type) {
    where.push('t.type = @type');
    req.input('type', sql.NVarChar(30), type);
  }
  if (status) {
    where.push('t.status = @status');
    req.input('status', sql.NVarChar(30), status);
  }
  if (provider) {
    where.push('t.provider = @provider');
    req.input('provider', sql.NVarChar(30), provider);
  }
  if (walletId) {
    where.push('t.walletId = @walletId');
    req.input('walletId', sql.UniqueIdentifier, walletId);
  }
  if (restaurantId) {
    where.push('w.restaurantId = @restaurantId');
    req.input('restaurantId', sql.UniqueIdentifier, restaurantId);
  }

  const itemsRs = await req.query(`
    SELECT
      t.id,
      t.walletId,
      t.bookingId,
      t.type,
      t.amount,
      t.currency,
      t.paymentMethod,
      t.referenceCode,
      t.providerTxnId,
      t.status,
      t.payerType,
      t.provider,
      t.description,
      t.idempotencyKey,
      t.createdAt,
      t.completedAt,
      w.restaurantId,
      w.userId,
      r.name AS restaurantName
    FROM dbo.Transactions t
    LEFT JOIN dbo.Wallets w ON w.id = t.walletId
    LEFT JOIN dbo.Restaurants r ON r.id = w.restaurantId
    WHERE ${where.join(' AND ')}
    ORDER BY t.createdAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countReq = pool.request();
  if (type) countReq.input('type', sql.NVarChar(30), type);
  if (status) countReq.input('status', sql.NVarChar(30), status);
  if (provider) countReq.input('provider', sql.NVarChar(30), provider);
  if (walletId) countReq.input('walletId', sql.UniqueIdentifier, walletId);
  if (restaurantId) countReq.input('restaurantId', sql.UniqueIdentifier, restaurantId);
  const countRs = await countReq.query(`
    SELECT COUNT(1) AS total
    FROM dbo.Transactions t
    LEFT JOIN dbo.Wallets w ON w.id = t.walletId
    WHERE ${where.join(' AND ')}
  `);

  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    data: itemsRs.recordset || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: total,
      totalPages: totalPages
    }
  };
}

// Thống kê doanh thu toàn hệ thống cho Admin (Hoa hồng) - Hỗ trợ Zero-filling
async function getAdminRevenueStats({ period = 'month', from, to } = {}) {
  const pool = await getPool();
  const req = pool.request();

  // Đảm bảo có giá trị mặc định cho from/to nếu bị thiếu
  const dFrom = from ? new Date(from) : new Date();
  const dTo = to ? new Date(to) : new Date();

  req.input('from', sql.DateTime, dFrom);
  req.input('to', sql.DateTime, dTo);

  let cteQuery = '';
  let selectTimeExpr = '';
  let joinOnExpr = '';

  const isToday = period.toLowerCase() === 'today' || period.toLowerCase() === 'day';

  if (isToday) {
    // Zero-filling theo Giờ (24 điểm) cho Today
    cteQuery = `
      WITH TimeSeries AS (
        SELECT 0 AS h
        UNION ALL
        SELECT h + 1 FROM TimeSeries WHERE h < 23
      )
    `;
    // Tạo ISO string cho từng mốc giờ dựa trên ngày 'from'
    const dateStr = dFrom.toISOString().split('T')[0];
    req.input('dateStr', sql.NVarChar(10), dateStr);
    
    selectTimeExpr = `CONCAT(@dateStr, 'T', RIGHT('0' + CAST(ts.h AS VARCHAR(2)), 2), ':00:00Z')`;
    joinOnExpr = `DATEPART(HOUR, b.bookingDate) = ts.h AND b.bookingDate >= @from AND b.bookingDate <= @to`;
  } else {
    // Zero-filling theo Ngày cho Week/Month
    cteQuery = `
      WITH TimeSeries AS (
        SELECT CAST(@from AS DATE) AS d
        UNION ALL
        SELECT DATEADD(DAY, 1, d) FROM TimeSeries WHERE d < CAST(@to AS DATE)
      )
    `;
    selectTimeExpr = `FORMAT(ts.d, 'yyyy-MM-ddT00:00:00Z')`;
    joinOnExpr = `CAST(b.bookingDate AS DATE) = ts.d`;
  }

  const query = `
    ${cteQuery}
    SELECT
      ${selectTimeExpr} AS timePeriod,
      (
        SELECT COUNT(1) FROM dbo.Bookings b 
        WHERE ${isToday ? 'DATEPART(HOUR, b.bookingDate) = ts.h AND b.bookingDate >= @from AND b.bookingDate <= @to' : 'CAST(b.bookingDate AS DATE) = ts.d'}
      ) AS totalBookings,
      (
        SELECT ISNULL(SUM(t.amount), 0) FROM dbo.Transactions t 
        WHERE t.walletId = '6EDEC0B0-EA2C-46CB-B940-C8A1A357A0C9' AND t.status = 'COMPLETED'
          AND ${isToday ? 'DATEPART(HOUR, t.createdAt) = ts.h AND t.createdAt >= @from AND t.createdAt <= @to' : 'CAST(t.createdAt AS DATE) = ts.d'}
      ) AS totalAdminCommission,
      (
        SELECT ISNULL(SUM(b.depositAmount), 0) FROM dbo.Bookings b 
        WHERE ${isToday ? 'DATEPART(HOUR, b.bookingDate) = ts.h AND b.bookingDate >= @from AND b.bookingDate <= @to' : 'CAST(b.bookingDate AS DATE) = ts.d'}
          AND b.status IN ('CONFIRMED', 'ARRIVED', 'COMPLETED', 'NO_SHOW')
      ) AS totalPlatformDeposit
    FROM TimeSeries ts
    ORDER BY ${isToday ? 'ts.h' : 'ts.d'} ASC
    OPTION (MAXRECURSION 366);
  `;

  const rs = await req.query(query);
  return rs.recordset || [];
}

// Lay cau hinh he thong theo key
async function getSystemConfig(key) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('key', sql.NVarChar(50), key)
    .query('SELECT configKey, configValue, description, updatedAt FROM dbo.SystemConfigs WHERE configKey = @key');
  return rs.recordset[0] || null;
}

// Cap nhat cau hinh he thong
async function updateSystemConfig(key, value) {
  const pool = await getPool();
  await pool.request()
    .input('key', sql.NVarChar(50), key)
    .input('value', sql.NVarChar(sql.MAX), value)
    .query(`
      UPDATE dbo.SystemConfigs 
      SET configValue = @value, 
          updatedAt = SYSUTCDATETIME() 
      WHERE configKey = @key
    `);
  return { success: true };
}

module.exports = {
  getDashboardStats,
  getPendingRestaurants,
  getRestaurants,
  getUserAuthById,
  getRestaurantById,
  approveRestaurant,
  suspendRestaurant,
  hardDeleteRestaurant,
  ensureRestaurantWallet,
  getUsers,
  getBookings,
  getTransactions,
  getAdminRevenueStats,
  getSystemConfig,
  updateSystemConfig
};