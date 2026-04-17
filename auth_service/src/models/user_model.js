const { sql, getPool } = require('../config/db');

async function findByPhoneOrEmail({ phone, email }) {
  const pool = await getPool();
  const req = pool.request();
  req.input('phone', sql.NVarChar(20), phone || null);
  req.input('email', sql.NVarChar(255), email || null);

  const result = await req.query(`
    SELECT TOP 1 *
    FROM dbo.Users
    WHERE (@phone IS NOT NULL AND phone = @phone)
       OR (@email IS NOT NULL AND email = @email)
    ORDER BY createdAt DESC
  `);

  return result.recordset[0] || null;
}

async function findAuthByPhoneAndEmail(phone, email) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('phone', sql.NVarChar(20), phone)
    .input('email', sql.NVarChar(255), email)
    .query(`SELECT TOP 1 * FROM dbo.Users WHERE phone = @phone AND email = @email`);
  return rs.recordset[0] || null;
}

async function findById(id) {
  const pool = await getPool();
  const res = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`SELECT TOP 1 * FROM dbo.Users WHERE id = @id`);
  return res.recordset[0] || null;
}

async function createUser({ phone, email = null, name, passwordHash, role = 'CUSTOMER', avatar = null, loyaltyPoints = 0 }) {
  const pool = await getPool();
  const req = pool.request();

  req.input('phone', sql.NVarChar(20), phone);
  req.input('email', sql.NVarChar(255), email);
  req.input('name', sql.NVarChar(100), name);
  req.input('password', sql.NVarChar(255), passwordHash);
  req.input('role', sql.NVarChar(30), role);
  req.input('avatar', sql.NVarChar(1024), avatar);
  req.input('loyaltyPoints', sql.Int, loyaltyPoints || 0);

  const result = await req.query(`
    INSERT INTO dbo.Users (phone, email, name, password, role, avatar, loyaltyPoints)
    OUTPUT INSERTED.*
    VALUES (@phone, @email, @name, @password, @role, @avatar, @loyaltyPoints)
  `);

  return result.recordset[0];
}

async function updatePasswordById(userId, passwordHash) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('password', sql.NVarChar(255), passwordHash)
    .query(`
      UPDATE dbo.Users
      SET password = @password, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

async function updateProfileById(userId, { name, email, avatar, role, phone }) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.UniqueIdentifier, userId);

  if (name !== undefined) req.input('name', sql.NVarChar(100), name);
  if (email !== undefined) req.input('email', sql.NVarChar(255), email);
  if (avatar !== undefined) req.input('avatar', sql.NVarChar(1024), avatar);
  if (role !== undefined) req.input('role', sql.NVarChar(30), role);
  if (phone !== undefined) req.input('phone', sql.NVarChar(20), phone);

  // Build SET clause dynamically to avoid overwriting with NULLs
  const sets = [];
  if (name !== undefined) sets.push('name = @name');
  if (email !== undefined) sets.push('email = @email');
  if (avatar !== undefined) sets.push('avatar = @avatar');
  if (role !== undefined) sets.push('role = @role');
  if (phone !== undefined) sets.push('phone = @phone');

  if (sets.length === 0) return await findById(userId);

  const sqlQuery = `
    UPDATE dbo.Users
    SET ${sets.join(', ')}, updatedAt = SYSUTCDATETIME()
    WHERE id = @id;
    SELECT TOP 1 * FROM dbo.Users WHERE id = @id;
  `;

  const res = await req.query(sqlQuery);
  return res.recordset[0] || null;
}

async function deleteById(userId) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .query('DELETE FROM dbo.Users WHERE id = @id');
  return true;
}

async function incrementLoyaltyPoints(userId, delta = 1) {
  const pool = await getPool();
  const req = pool.request()
    .input('id', sql.UniqueIdentifier, userId)
    .input('delta', sql.Int, delta);

  const res = await req.query(`
    UPDATE dbo.Users
    SET loyaltyPoints = ISNULL(loyaltyPoints, 0) + @delta, updatedAt = SYSUTCDATETIME()
    OUTPUT INSERTED.loyaltyPoints
    WHERE id = @id
  `);

  return res.recordset[0] ? res.recordset[0].loyaltyPoints : null;
}

module.exports = {
  findByPhoneOrEmail,
  findAuthByPhoneAndEmail,
  findById,
  createUser,
  updatePasswordById,
  updateProfileById,
  incrementLoyaltyPoints,
  deleteById
};
