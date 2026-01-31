/**
 * menu.controller (placeholder)
 */
const menuSvc = require('../services/menu_service');

// Hàm liệt kê thực đơn của một nhà hàng
async function list(req, res) {
  try {
    const data = await menuSvc.listMenu(req.params.id);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo mục thực đơn mới cho một nhà hàng
async function create(req, res) {
  try {
    const data = await menuSvc.createMenuItem(req.params.id, req.body);
    res.status(201).json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật mục thực đơn của một nhà hàng
async function update(req, res) {
  try {
    const data = await menuSvc.updateMenuItem(req.params.id, req.params.itemId, req.body);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm xóa mục thực đơn của một nhà hàng
async function remove(req, res) {
  try {
    const ok = await menuSvc.deleteMenuItem(req.params.id, req.params.itemId);
    res.json({ ok });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

module.exports = { list, create, update, remove };

