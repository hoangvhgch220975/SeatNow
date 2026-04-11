/**
 * menu.controller (placeholder)
 */
const menuSvc = require('../services/menu_service');

// Hàm liệt kê thực đơn của một nhà hàng
async function list(req, res) {
  try {
    const restaurantId = await require('../services/restaurant_service').resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });
    
    const { menuItems, total } = await menuSvc.listMenu(restaurantId, req.query);
    res.json({ 
      data: menuItems, 
      total, 
      meta: { 
        limit: parseInt(req.query.limit || 100, 10), 
        offset: parseInt(req.query.offset || 0, 10) 
      } 
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo mục thực đơn mới cho một nhà hàng
async function create(req, res) {
  try {
    const restaurantId = await require('../services/restaurant_service').resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });
    
    const data = await menuSvc.createMenuItem(restaurantId, req.body);
    res.status(201).json({ data });
  } catch (e) {
    console.error('[menu.controller.create] error', e);
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật mục thực đơn của một nhà hàng
async function update(req, res) {
  try {
    const restaurantId = await require('../services/restaurant_service').resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const data = await menuSvc.updateMenuItem(restaurantId, req.params.itemId, req.body);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm xóa mục thực đơn của một nhà hàng
async function remove(req, res) {
  try {
    const restaurantId = await require('../services/restaurant_service').resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const ok = await menuSvc.deleteMenuItem(restaurantId, req.params.itemId);
    res.json({ ok });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

module.exports = { list, create, update, remove };

