/**
 * table.sql.js - raw SQL queries (placeholders)
 */
const { sql, getPool } = require('../config/sql');

/**
 * Tables thuộc restaurant, dùng cho UI chọn bàn (capacity, type, status)
 */

// Lấy danh sách bàn theo restaurantId
async function listByRestaurant(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT id, restaurantId, tableNumber, capacity, [type], [location], [status], createdAt, updatedAt
      FROM dbo.Tables
      WHERE restaurantId=@restaurantId
      ORDER BY tableNumber ASC;
    `);
  return rs.recordset;
}

// Tìm bàn theo id
async function findById(id) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      SELECT TOP 1 id, restaurantId, tableNumber, capacity, [type], [location], [status], createdAt, updatedAt
      FROM dbo.Tables
      WHERE id=@id;
    `);
  return rs.recordset[0] || null;
}

// Tạo bàn mới
async function createTable({ restaurantId, tableNumber, capacity, type = 'standard', location = null, status = 'available' }) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('tableNumber', sql.NVarChar(50), tableNumber)
    .input('capacity', sql.Int, capacity)
    .input('type', sql.NVarChar(50), type)
    .input('location', sql.NVarChar(255), location)
    .input('status', sql.NVarChar(30), status)
    .query(`
      INSERT INTO dbo.Tables (restaurantId, tableNumber, capacity, [type], [location], [status])
      OUTPUT INSERTED.*
      VALUES (@restaurantId, @tableNumber, @capacity, @type, @location, @status);
    `);
  return rs.recordset[0];
}

// Cập nhật bàn
async function updateTable(id, patch) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.UniqueIdentifier, id);
  const sets = [];

  const map = {
    tableNumber: ['tableNumber', sql.NVarChar(50)],
    capacity: ['capacity', sql.Int],
    type: ['[type]', sql.NVarChar(50)],
    location: ['[location]', sql.NVarChar(255)],
    status: ['[status]', sql.NVarChar(30)]
  };

  for (const k of Object.keys(map)) {
    if (patch[k] === undefined) continue;
    const [col, t] = map[k];
    sets.push(`${col}=@${k}`);
    req.input(k, t, patch[k]);
  }

  if (!sets.length) return findById(id);

  const rs = await req.query(`
    UPDATE dbo.Tables
    SET ${sets.join(', ')}, updatedAt=SYSUTCDATETIME()
    OUTPUT INSERTED.*
    WHERE id=@id;
  `);

  return rs.recordset[0] || null;
}

// Xoá bàn
async function deleteTable(id) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`DELETE FROM dbo.Tables WHERE id=@id;`);
  return true;
}

module.exports = { listByRestaurant, findById, createTable, updateTable, deleteTable };