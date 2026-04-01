/**
 * table.controller (placeholder)
 */
const tableSvc = require('../services/table_service');

// Hàm liệt kê các bàn của một nhà hàng (hỗ trợ lọc theo location)
async function list(req, res) {
  try {
    const { location } = req.query;
    const data = await tableSvc.listTables(req.params.id, location);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo bàn mới cho một nhà hàng
async function create(req, res) {
  try {
    const data = await tableSvc.createTable({
      restaurantId: req.params.id,
      tableNumber: req.body.tableNumber,
      capacity: req.body.capacity,
      type: req.body.type,
      location: req.body.location || null,
      status: req.body.status
    });
    res.status(201).json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật thông tin bàn
async function update(req, res) {
  try {
    const data = await tableSvc.updateTable(req.params.tableId, req.body);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm xóa bàn
async function remove(req, res) {
  try {
    const ok = await tableSvc.deleteTable(req.params.tableId);
    res.json({ ok });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm thống kê bàn theo tầng/vị trí
async function getStats(req, res) {
  try {
    const data = await tableSvc.getStatsByLocation(req.params.id);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

module.exports = { list, create, update, remove, getStats };
