const { sql, getPool } = require('../config/db');

async function findById(userId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .query(`
      SELECT TOP 1
        id, phone, email, name, role, avatar, loyaltyPoints, createdAt, updatedAt
      FROM dbo.Users
      WHERE id = @id
    `);
  return rs.recordset[0] || null;
}

async function updateProfileById(userId, { name, email, avatar }) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('name', sql.NVarChar(100), name ?? null)
    .input('email', sql.NVarChar(255), email ?? null)
    .input('avatar', sql.NVarChar(1024), avatar ?? null)
    .query(`
      UPDATE dbo.Users
      SET
        name = COALESCE(@name, name),
        email = @email,
        avatar = @avatar,
        updatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.id, INSERTED.phone, INSERTED.email, INSERTED.name,
             INSERTED.role, INSERTED.avatar, INSERTED.loyaltyPoints,
             INSERTED.createdAt, INSERTED.updatedAt
      WHERE id = @id
    `);
  return rs.recordset[0] || null;
}

async function getLoyaltyPointsById(userId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .query(`SELECT TOP 1 loyaltyPoints FROM dbo.Users WHERE id = @id`);
  return rs.recordset[0] ? rs.recordset[0].loyaltyPoints : null;
}

async function getWalletByUserId(userId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`
      SELECT TOP 1 id, userId, balance, lockedAmount, createdAt, updatedAt
      FROM dbo.Wallets
      WHERE userId = @userId
    `);
  return rs.recordset[0] || null;
}

async function ensureWalletForUser(userId) {
  const existing = await getWalletByUserId(userId);
  if (existing) return existing;

  const pool = await getPool();
  const rs = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`
      INSERT INTO dbo.Wallets (userId, balance, lockedAmount)
      OUTPUT INSERTED.id, INSERTED.userId, INSERTED.balance, INSERTED.lockedAmount, INSERTED.createdAt, INSERTED.updatedAt
      VALUES (@userId, 0, 0)
    `);
  return rs.recordset[0];
}

async function getBookingsByCustomerId(userId, { offset, limit }) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('customerId', sql.UniqueIdentifier, userId)
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT
        id, bookingCode, restaurantId, tableId,
        bookingDate, bookingTime, numGuests, status,
        depositRequired, depositAmount, depositPaid, depositPaidAt,
        createdAt, updatedAt
      FROM dbo.Bookings
      WHERE customerId = @customerId
      ORDER BY bookingDate DESC, bookingTime DESC, createdAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  return rs.recordset;
}

module.exports = {
  findById,
  updateProfileById,
  getLoyaltyPointsById,
  getWalletByUserId,
  ensureWalletForUser,
  getBookingsByCustomerId
};
