/**
 * table.sql.js - raw SQL queries (placeholders)
 */
const { sql, getPool } = require('../config/sql');

/**
 * Tables thuộc restaurant, dùng cho UI chọn bàn (capacity, type, status)
 */

// Lấy danh sách bàn theo restaurantId, có hỗ trợ lọc theo location
async function listByRestaurant(restaurantId, location = null) {
  const pool = await getPool();
  const request = pool.request().input('restaurantId', sql.UniqueIdentifier, restaurantId);
  
  let query = `
    SELECT id, restaurantId, tableNumber, capacity, [type], [location], [status], createdAt, updatedAt
    FROM dbo.Tables
    WHERE restaurantId=@restaurantId
  `;
  
  if (location) {
    request.input('location', sql.NVarChar(255), location);
    query += ' AND [location]=@location';
  }
  
  query += ' ORDER BY tableNumber ASC;';
  
  const rs = await request.query(query);
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
async function updateTable(restaurantId, id, patch) {
  const pool = await getPool();
  const req = pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('restaurantId', sql.UniqueIdentifier, restaurantId);
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
    WHERE id=@id AND restaurantId=@restaurantId;
  `);

  return rs.recordset[0] || null;
}

// Xoá bàn
async function deleteTable(restaurantId, id) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`DELETE FROM dbo.Tables WHERE id=@id AND restaurantId=@restaurantId;`);
  return true;
}

// Thống kê bàn theo location (tầng)
async function getStatsByLocation(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT 
        [location],
        COUNT(*) as totalTables,
        SUM(CASE WHEN [status] = 'available' THEN 1 ELSE 0 END) as availableTables,
        SUM(CASE WHEN [status] = 'unavailable' THEN 1 ELSE 0 END) as busyTables,
        SUM(CASE WHEN [status] = 'maintenance' THEN 1 ELSE 0 END) as maintenanceTables,
        SUM(capacity) as totalCapacity
      FROM dbo.Tables
      WHERE restaurantId=@restaurantId
      GROUP BY [location]
      ORDER BY [location] ASC;
    `);
  return rs.recordset;
}
// Thống kê tổng quát bàn của 1 nhà hàng
async function getGlobalStats(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT 
        COUNT(*) as totalTables,
        SUM(CASE WHEN [status] = 'available' THEN 1 ELSE 0 END) as availableTables,
        SUM(CASE WHEN [status] = 'unavailable' THEN 1 ELSE 0 END) as busyTables,
        SUM(CASE WHEN [status] = 'maintenance' THEN 1 ELSE 0 END) as maintenanceTables
      FROM dbo.Tables
      WHERE restaurantId=@restaurantId;
    `);
  return rs.recordset[0] || {
    totalTables: 0,
    availableTables: 0,
    busyTables: 0,
    maintenanceTables: 0
  };
}

module.exports = { listByRestaurant, findById, createTable, updateTable, deleteTable, getStatsByLocation, getGlobalStats };