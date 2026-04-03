/**
 * user_sql.js - Các truy vấn SQL cho bảng Users
 * - Dùng để lấy thông tin cơ bản: tên, ảnh đại diện
 */
const { sql, getPool } = require('../config/sql');

/**
 * Lấy danh sách thông tin người dùng theo bộ ID
 * @param {string[]} ids - Danh sách các UniqueIdentifier ID
 * @returns {Promise<Object[]>} - Trả về mảng chứa {id, name, avatar}
 */
async function findUsersByIds(ids) {
  // Lọc chỉ giữ lại các ID hợp lệ định dạng UUID để tránh lỗi SQL
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validIds = (ids || []).filter(id => id && uuidRegex.test(id));

  if (validIds.length === 0) return [];

  const pool = await getPool();
  const request = pool.request();

  // Tạo câu lệnh IN động cho các ID hợp lệ
  const idParams = validIds.map((id, index) => {
    const paramName = `id${index}`;
    request.input(paramName, sql.UniqueIdentifier, id);
    return `@${paramName}`;
  });

  const query = `
    SELECT id, name, avatar
    FROM dbo.Users
    WHERE id IN (${idParams.join(', ')})
  `;

  // Thực thi truy vấn
  const result = await request.query(query);
  
  // Trả về danh sách người dùng
  return result.recordset;
}

module.exports = {
  findUsersByIds
};
