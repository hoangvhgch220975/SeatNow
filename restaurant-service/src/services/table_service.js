/**
 * availability.service (placeholder)
 * Should compute available tables for a restaurant and date/time.
 */
const tableSql = require('../models/table_sql');

// Hàm liệt kê các bàn trong nhà hàng
async function listTables(restaurantId) {
  return tableSql.listByRestaurant(restaurantId);
}

// Hàm tạo một bàn mới trong nhà hàng
async function createTable(payload) {
  // payload: { restaurantId, tableNumber, capacity, type, location, status }
  return tableSql.createTable(payload);
}

// Hàm cập nhật thông tin của một bàn dựa trên ID và payload, có thể dùng để thay đổi trạng thái bàn
async function updateTable(id, patch) {
  return tableSql.updateTable(id, patch);
}

// Hàm xóa một bàn khỏi nhà hàng dựa trên ID
async function deleteTable(id) {
  return tableSql.deleteTable(id);
}

module.exports = { listTables, createTable, updateTable, deleteTable };
