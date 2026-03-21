/**
 * restaurant.controller (placeholder)
 */
const restaurantSvc = require('../services/restaurant_service');

// Các trường chỉ ADMIN mới được thay đổi
const ADMIN_ONLY_FIELDS = ['status', 'isPremium', 'commissionRate'];

// Hàm liệt kê nhà hàng với phân trang và lọc
async function list(req, res) {
  try {
    const data = await restaurantSvc.listRestaurants(req.query);
    res.json({ data, meta: { limit: req.query.limit, offset: req.query.offset } });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm lấy thông tin chi tiết của một nhà hàng dựa trên ID
async function detail(req, res) {
  try {
    const r = await restaurantSvc.getRestaurant(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    res.json({ data: r });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo mới một nhà hàng (chỉ ADMIN)
// ownerId lấy từ body - admin tạo nhà hàng thay cho owner
async function create(req, res) {
  try {
    const data = await restaurantSvc.createRestaurant(req.body);
    res.status(201).json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật thông tin nhà hàng
// - ADMIN: cập nhật mọi trường
// - RESTAURANT_OWNER: chỉ cập nhật thông tin thông thường, không được sửa trường nhạy cảm
async function update(req, res) {
  try {
    const payload = { ...req.body };
    const role = req.user?.role;

    // Strip các trường admin-only nếu không phải ADMIN
    if (role !== 'ADMIN') {
      for (const f of ADMIN_ONLY_FIELDS) delete payload[f];
    }

    // Kiểm tra ownership nếu là RESTAURANT_OWNER
    if (role === 'RESTAURANT_OWNER') {
      const existing = await restaurantSvc.getRestaurant(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Not found' });
      if (existing.ownerId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: not your restaurant' });
      }
    }

    const data = await restaurantSvc.updateRestaurant(req.params.id, payload);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật chính sách đặt cọc của nhà hàng
async function updateDepositPolicy(req, res) {
  try {
    const data = await restaurantSvc.updateDepositPolicy(req.params.id, req.body);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}
// Hàm xóa mềm nhà hàng
async function remove(req, res) {
  try {
    const data = await restaurantSvc.softDeleteRestaurant(req.params.id);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Proxy availability sang booking-service de dung chung logic slot/table.
async function availability(req, res) {
  try {
    const restaurantId = req.params.id;
    const data = await restaurantSvc.getAvailability({
      restaurantId,
      date: req.query.date,
      time: req.query.time,
      guests: req.query.guests
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 400).json({ message: e.message });
  }
}

// Hàm lấy thống kê doanh thu
async function revenueStats(req, res) {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : '';
    const data = await restaurantSvc.getRevenueStats({
      restaurantId: req.params.id,
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
      token
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 400).json({ message: e.message });
  }
}

module.exports = {
  list,
  detail,
  create,
  update,
  updateDepositPolicy,
  remove,
  availability,
  revenueStats
};
