/**
 * menu.service (placeholder)
 */
const MenuItem = require('../models/menuItem_mongo');

// Hàm liệt kê các món ăn trong menu của một nhà hàng
async function listMenu(restaurantId, { limit = 100, offset = 0 } = {}) {
  const [rows, total] = await Promise.all([
    MenuItem.find({ restaurantId })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean(),
    MenuItem.countDocuments({ restaurantId })
  ]);
  return { menuItems: rows, total };
}

// Hàm tạo một món ăn mới trong menu của nhà hàng
async function createMenuItem(restaurantId, payload) {
  const doc = await MenuItem.create({ ...payload, restaurantId });
  return doc.toObject();
}

// Hàm cập nhật thông tin của một món ăn trong menu
async function updateMenuItem(restaurantId, itemId, patch) {
  const doc = await MenuItem.findOneAndUpdate(
    { _id: itemId, restaurantId },
    { $set: { ...patch, updatedAt: new Date() } },
    { new: true }
  ).lean();
  return doc;
}

// Hàm xóa một món ăn khỏi menu của nhà hàng
async function deleteMenuItem(restaurantId, itemId) {
  const rs = await MenuItem.deleteOne({ _id: itemId, restaurantId });
  return rs.deletedCount > 0;
}

module.exports = { listMenu, createMenuItem, updateMenuItem, deleteMenuItem };

