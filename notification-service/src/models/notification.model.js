/**
 * notification.model.js - Logic truy vấn SQL cho bảng dbo.Notifications
 */
const { sql, getPool } = require('../config/db');

/**
 * Lưu một thông báo mới vào Database
 * @param {object} data - { ownerId, restaurantId, type, title, message, metadata }
 */
async function saveNotification({ ownerId, restaurantId = null, type, title, message, metadata = null }) {
  const pool = await getPool();
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  const result = await pool.request()
    .input('ownerId',      sql.UniqueIdentifier, ownerId)
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('type',         sql.NVarChar(50),     type)
    .input('title',        sql.NVarChar(255),    title)
    .input('message',      sql.NVarChar(1000),   message)
    .input('metadata',     sql.NVarChar(sql.MAX), metadataStr)
    .query(`
      INSERT INTO dbo.Notifications (ownerId, restaurantId, type, title, message, metadata, isRead, createdAt)
      OUTPUT INSERTED.id
      VALUES (@ownerId, @restaurantId, @type, @title, @message, @metadata, 0, SYSUTCDATETIME())
    `);
  
  return result.recordset[0].id;
}

/**
 * Lấy danh sách hoạt động gần đây của Owner (có phân trang)
 * @param {string} ownerId - ID của chủ sở hữu
 * @param {number} limit - Số lượng bản ghi trả về (mặc định 20)
 * @param {number} offset - Vị trí bắt đầu (mặc định 0)
 * @param {string} type - Lọc theo loại thông báo (tùy chọn)
 * @returns {object} - { total, unreadCount, items }
 */
async function getOwnerActivity(ownerId, { limit = 20, offset = 0, type = null } = {}) {
  const pool = await getPool();
  const req = pool.request()
    .input('ownerId', sql.UniqueIdentifier, ownerId)
    .input('limit',   sql.Int, limit)
    .input('offset',  sql.Int, offset);

  // Điều kiện lọc theo loại (nếu có)
  const typeFilter = type ? 'AND type = @type' : '';
  if (type) req.input('type', sql.NVarChar(50), type);

  const rs = await req.query(`
    SELECT
      id,
      ownerId,
      restaurantId,
      type,
      title,
      message,
      metadata,
      isRead,
      createdAt
    FROM dbo.Notifications
    WHERE ownerId = @ownerId ${typeFilter}
    ORDER BY createdAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  // Đếm tổng số bản ghi và số chưa đọc
  const countReq = pool.request()
    .input('ownerId', sql.UniqueIdentifier, ownerId);
  if (type) countReq.input('type', sql.NVarChar(50), type);

  const countRs = await countReq.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN isRead = 0 THEN 1 ELSE 0 END) AS unreadCount
    FROM dbo.Notifications
    WHERE ownerId = @ownerId ${typeFilter}
  `);

  const { total, unreadCount } = countRs.recordset[0];

  return {
    total: Number(total || 0),
    unreadCount: Number(unreadCount || 0),
    items: rs.recordset.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isRead: row.isRead === true || row.isRead === 1
    }))
  };
}

/**
 * Đánh dấu một thông báo là đã đọc
 * @param {string} notificationId - ID của thông báo
 * @param {string} ownerId - ID của Owner (để xác minh quyền sở hữu)
 */
async function markAsRead(notificationId, ownerId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id',      sql.UniqueIdentifier, notificationId)
    .input('ownerId', sql.UniqueIdentifier, ownerId)
    .query(`
      UPDATE dbo.Notifications
      SET isRead = 1
      WHERE id = @id AND ownerId = @ownerId
    `);
  return rs.rowsAffected[0] > 0;
}

/**
 * Đánh dấu TẤT CẢ thông báo của Owner là đã đọc
 * @param {string} ownerId - ID của chủ sở hữu
 */
async function markAllAsRead(ownerId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('ownerId', sql.UniqueIdentifier, ownerId)
    .query(`
      UPDATE dbo.Notifications
      SET isRead = 1
      WHERE ownerId = @ownerId AND isRead = 0
    `);
  return rs.rowsAffected[0];
}

/**
 * Lấy danh sách hoạt động hệ thống cho Admin (ownerId IS NULL)
 * @param {number} limit
 * @param {number} offset
 * @param {string} type
 */
async function getAdminActivity({ limit = 20, offset = 0, type = null } = {}) {
  const pool = await getPool();
  const req = pool.request()
    .input('limit',   sql.Int, limit)
    .input('offset',  sql.Int, offset);

  const typeFilter = type ? 'AND type = @type' : '';
  if (type) req.input('type', sql.NVarChar(50), type);

  const rs = await req.query(`
    SELECT
      id,
      ownerId,
      restaurantId,
      type,
      title,
      message,
      metadata,
      isRead,
      createdAt
    FROM dbo.Notifications
    WHERE ownerId IS NULL ${typeFilter}
    ORDER BY createdAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countReq = pool.request();
  if (type) countReq.input('type', sql.NVarChar(50), type);

  const countRs = await countReq.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN isRead = 0 THEN 1 ELSE 0 END) AS unreadCount
    FROM dbo.Notifications
    WHERE ownerId IS NULL ${typeFilter}
  `);

  const { total, unreadCount } = countRs.recordset[0];

  return {
    total: Number(total || 0),
    unreadCount: Number(unreadCount || 0),
    items: rs.recordset.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isRead: row.isRead === true || row.isRead === 1
    }))
  };
}

/**
 * Đánh dấu TẤT CẢ thông báo Admin là đã đọc
 */
async function markAllAdminAsRead() {
  const pool = await getPool();
  const rs = await pool.request()
    .query(`
      UPDATE dbo.Notifications
      SET isRead = 1
      WHERE ownerId IS NULL AND isRead = 0
    `);
  return rs.rowsAffected[0];
}

/**
 * Đánh dấu một thông báo Admin là đã đọc
 * @param {string} notificationId 
 */
async function markAdminAsRead(notificationId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, notificationId)
    .query(`
      UPDATE dbo.Notifications
      SET isRead = 1
      WHERE id = @id AND ownerId IS NULL
    `);
  return rs.rowsAffected[0] > 0;
}

module.exports = { saveNotification, getOwnerActivity, getAdminActivity, markAsRead, markAllAsRead, markAllAdminAsRead, markAdminAsRead };
