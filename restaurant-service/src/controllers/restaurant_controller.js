/**
 * restaurant.controller (placeholder)
 */
const restaurantSvc = require('../services/restaurant_service');

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

// Hàm tạo mới một nhà hàng
async function create(req, res) {
  try {
    const ownerId = req.user?.userId || req.user?.id;
    const data = await restaurantSvc.createRestaurant(ownerId, req.body);
    res.status(201).json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật thông tin nhà hàng
async function update(req, res) {
  try {
    // Chỉ admin mới được cập nhật trường 'status'
    const payload = { ...req.body };
    if (payload.hasOwnProperty('status') && req.user?.role !== 'ADMIN') {
      delete payload.status;
      res.status(403).json({ message: 'Permission denied' });
      return;
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

module.exports = {
  list,
  detail,
  create,
  update,
  updateDepositPolicy,
  remove,
  availability
};
