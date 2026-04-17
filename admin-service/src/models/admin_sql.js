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

// Lay so lieu tong quan cho dashboard admin, hỗ trợ lọc theo thời gian.
async function getDashboardStats({ dateFrom, dateTo } = {}) {
  const pool = await getPool();
  const req = pool.request();

  let dateFilterBookings = '';
  let dateFilterTransactions = '';
  let dateFilterUsers = '';
  let dateFilterRestaurants = '';

  if (dateFrom) {
    req.input('df', sql.DateTime, dateFrom);
    dateFilterBookings += ' AND bookingDate >= @df';
    dateFilterTransactions += ' AND createdAt >= @df';
    dateFilterUsers += ' AND createdAt >= @df';
    dateFilterRestaurants += ' AND createdAt >= @df';
  }
  if (dateTo) {
    req.input('dt', sql.DateTime, dateTo);
    dateFilterBookings += ' AND bookingDate <= @dt';
    dateFilterTransactions += ' AND createdAt <= @dt';
    dateFilterUsers += ' AND createdAt <= @dt';
    dateFilterRestaurants += ' AND createdAt <= @dt';
  }

  const rs = await req.query(`
    SELECT
      -- Global Stats (Snapshot)
      (SELECT COUNT(1) FROM dbo.Users) AS totalUsers,
      (SELECT COUNT(1) FROM dbo.Restaurants) AS totalRestaurants,
      (SELECT COUNT(1) FROM dbo.Restaurants WHERE LOWER(ISNULL(status, '')) = 'pending') AS pendingRestaurants,
      (SELECT ISNULL(SUM(balance), 0) FROM dbo.Wallets) AS totalWalletBalance,

      -- Periodic Stats (Filtered)
      (SELECT COUNT(1) FROM dbo.Users WHERE 1=1 ${dateFilterUsers}) AS newUsers,
      (SELECT COUNT(1) FROM dbo.Users WHERE role = 'RESTAURANT_OWNER' ${dateFilterUsers}) AS newOwners,
      (SELECT COUNT(1) FROM dbo.Restaurants WHERE LOWER(ISNULL(status, '')) = 'active' ${dateFilterRestaurants}) AS newActiveRestaurants,
      
      (SELECT COUNT(1) FROM dbo.Bookings WHERE 1=1 ${dateFilterBookings}) AS totalBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'PENDING' ${dateFilterBookings}) AS pendingBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'CONFIRMED' ${dateFilterBookings}) AS confirmedBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'COMPLETED' ${dateFilterBookings}) AS completedBookings,
      (SELECT COUNT(1) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) IN ('CANCELLED', 'NO_SHOW') ${dateFilterBookings}) AS cancelledBookings,
      
      (SELECT ISNULL(SUM(commissionFee), 0) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'COMPLETED' ${dateFilterBookings}) AS totalCommission,
      (SELECT ISNULL(SUM(depositAmount), 0) FROM dbo.Bookings WHERE UPPER(ISNULL(status, '')) = 'COMPLETED' ${dateFilterBookings}) AS totalDeposit,

      (SELECT COUNT(1) FROM dbo.Transactions WHERE 1=1 ${dateFilterTransactions}) AS totalTransactions,
      (SELECT COUNT(1) FROM dbo.Transactions WHERE UPPER(ISNULL(type, '')) = 'DEPOSIT_PAYMENT' ${dateFilterTransactions}) AS totalDepositTransactions
  `);

  return rs.recordset[0] || {};
}

// Lay danh sach nha hang dang o trang thai pending.
async function getPendingRestaurants() {
  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT
      r.id,
      r.name,
      r.ownerId,
      r.status,
      r.createdAt,
      r.updatedAt,
      u.name AS ownerName,
      u.email AS ownerEmail,
      u.phone AS ownerPhone
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Users u ON u.id = r.ownerId
    WHERE LOWER(ISNULL(r.status, '')) = 'pending'
    ORDER BY r.createdAt DESC
  `);

  return rs.recordset || [];
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

  return {
    data: itemsRs.recordset || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRs.recordset[0]?.total || 0)
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

  return {
    data: itemsRs.recordset || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRs.recordset[0]?.total || 0)
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

  return {
    data: itemsRs.recordset || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRs.recordset[0]?.total || 0)
    }
  };
}

// Thống kê doanh thu toàn hệ thống cho Admin (Hoa hồng)
async function getAdminRevenueStats({ period = 'month', from, to } = {}) {
  const pool = await getPool();
  const req = pool.request();

  let periodExpr = "FORMAT(bookingDate, 'yyyy-MM-dd')"; // day
  if (period === 'week') {
    periodExpr = "CONCAT(YEAR(bookingDate), '-W', RIGHT('0' + CAST(DATEPART(iso_week, bookingDate) AS VARCHAR(2)), 2))";
  } else if (period === 'month') {
    periodExpr = "FORMAT(bookingDate, 'yyyy-MM')";
  } else if (period === 'quarter') {
    periodExpr = "CONCAT(YEAR(bookingDate), '-Q', DATEPART(quarter, bookingDate))";
  } else if (period === 'year') {
    periodExpr = "FORMAT(bookingDate, 'yyyy')";
  }

  const where = [
    "(status IN ('CONFIRMED', 'ARRIVED', 'COMPLETED', 'NO_SHOW') OR (status = 'CANCELLED' AND ISNULL(depositRefunded, 0) = 0))",
    "ISNULL(commissionFee, 0) > 0"
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
    SELECT
      ${periodExpr} AS timePeriod,
      COUNT(id) AS totalBookings,
      ISNULL(SUM(depositAmount), 0) AS totalPlatformDeposit,
      ISNULL(SUM(commissionFee), 0) AS totalAdminCommission
    FROM dbo.Bookings
    WHERE ${where.join(' AND ')}
    GROUP BY ${periodExpr}
    ORDER BY ${periodExpr} ASC
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
  getUserAuthById,
  getRestaurantById,
  approveRestaurant,
  suspendRestaurant,
  ensureRestaurantWallet,
  getUsers,
  getBookings,
  getTransactions,
  getAdminRevenueStats,
  getSystemConfig,
  updateSystemConfig
};