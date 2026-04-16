/**
 * booking_sql.js - Các truy vấn SQL cho bảng Bookings
 * (Dùng nội bộ trong Restaurant Service để kiểm tra trạng thái)
 */
const { sql, getPool } = require('../config/sql');

/**
 * Lấy trạng thái của một đơn đặt chỗ
 * @param {string} id - UUID của booking
 * @returns {Promise<Object|null>} - {id, status, customerId}
 */
async function getBookingStatus(id) {
  if (!id) return null;
  
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT id, status, customerId FROM dbo.Bookings WHERE id = @id');
    
  return result.recordset[0] || null;
}

module.exports = {
  getBookingStatus
};
