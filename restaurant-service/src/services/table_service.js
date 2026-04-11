/**
 * availability.service (placeholder)
 * Should compute available tables for a restaurant and date/time.
 */
const tableSql = require('../models/table_sql');

// Hàm liệt kê các bàn trong nhà hàng (hỗ trợ lọc theo vị trí/tầng)
async function listTables(restaurantId, location = null) {
  return tableSql.listByRestaurant(restaurantId, location);
}

// Hàm tạo một bàn mới trong nhà hàng
async function createTable(payload) {
  // payload: { restaurantId, tableNumber, capacity, type, location, status }
  return tableSql.createTable(payload);
}

// Hàm cập nhật thông tin của một bàn dựa trên ID và payload, có thể dùng để thay đổi trạng thái bàn
async function updateTable(restaurantId, id, patch) {
  return tableSql.updateTable(restaurantId, id, patch);
}

// Hàm xóa một bàn khỏi nhà hàng dựa trên ID
async function deleteTable(restaurantId, id) {
  return tableSql.deleteTable(restaurantId, id);
}

// Hàm thống kê bàn theo vị trí/tầng
async function getStatsByLocation(restaurantId) {
  return tableSql.getStatsByLocation(restaurantId);
}

// Thống kê tổng quát các bàn theo ID nhà hàng
async function getGlobalStats(restaurantId) {
  return tableSql.getGlobalStats(restaurantId);
}

module.exports = { listTables, createTable, updateTable, deleteTable, getStatsByLocation, getGlobalStats };
