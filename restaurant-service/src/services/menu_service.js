/**
 * menu.service (placeholder)
 */
const MenuItem = require('../models/menuItem_mongo');

// Hàm liệt kê các món ăn trong menu của một nhà hàng với các bộ lọc và sắp xếp nâng cao
async function listMenu(restaurantId, { 
  limit = 100, 
  offset = 0, 
  search = '', 
  category = '', 
  status = '', 
  sortBy = 'newest' 
} = {}) {
  const query = { restaurantId };

  // 1. Lọc theo từ khóa tìm kiếm (tên hoặc mô tả)
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // 2. Lọc theo danh mục
  if (category && category !== 'all' && category !== '') {
    query.category = category;
  }

  // 3. Lọc theo trạng thái (isAvailable)
  if (status === 'true' || status === true) {
    query.isAvailable = true;
  } else if (status === 'false' || status === false) {
    query.isAvailable = false;
  }

  // 4. Xử lý sắp xếp
  let sortOption = { createdAt: -1 }; // Mặc định là mới nhất
  switch (sortBy) {
    case 'price_asc':
      sortOption = { price: 1 };
      break;
    case 'price_desc':
      sortOption = { price: -1 };
      break;
    case 'name_asc':
      sortOption = { name: 1 };
      break;
    case 'name_desc':
      sortOption = { name: -1 };
      break;
    case 'oldest':
      sortOption = { createdAt: 1 };
      break;
    default:
      sortOption = { createdAt: -1 };
  }

  const [rows, total] = await Promise.all([
    MenuItem.find(query)
      .sort(sortOption)
      .skip(Number(offset))
      .limit(Number(limit))
      .lean(),
    MenuItem.countDocuments(query)
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

