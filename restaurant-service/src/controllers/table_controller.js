/**
 * table.controller
 * Quản lý các thực thể bàn vật lý
 */
const tableSvc = require('../services/table_service');
const restaurantSvc = require('../services/restaurant_service');

// Helper kiểm tra quyền sở hữu nhà hàng
async function checkOwnership(req, restaurantId) {
  if (req.user?.role === 'ADMIN') return true;
  if (req.user?.role === 'RESTAURANT_OWNER') {
    const r = await restaurantSvc.getRestaurant(restaurantId);
    if (!r) return false;
    if (r.ownerId !== (req.user.id || req.user.sub)) return false;
    return true;
  }
  return false;
}

// Hàm liệt kê các bàn của một nhà hàng (ai cũng có thể xem nếu authOptional cho phép)
async function list(req, res) {
  try {
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });
    
    const { location } = req.query;
    const data = await tableSvc.listTables(restaurantId, location);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm tạo bàn mới cho một nhà hàng
async function create(req, res) {
  try {
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const isOwner = await checkOwnership(req, restaurantId);
    if (!isOwner) return res.status(403).json({ message: 'Forbidden: not your restaurant' });

    const data = await tableSvc.createTable({
      restaurantId: restaurantId,
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
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const isOwner = await checkOwnership(req, restaurantId);
    if (!isOwner) return res.status(403).json({ message: 'Forbidden: not your restaurant' });

    const data = await tableSvc.updateTable(restaurantId, req.params.tableId, req.body);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm xóa bàn
async function remove(req, res) {
  try {
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const isOwner = await checkOwnership(req, restaurantId);
    if (!isOwner) return res.status(403).json({ message: 'Forbidden: not your restaurant' });

    const ok = await tableSvc.deleteTable(restaurantId, req.params.tableId);
    res.json({ ok });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm thống kê bàn tổng hợp cho Dashboard
async function getStats(req, res) {
  try {
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const isOwner = await checkOwnership(req, restaurantId);
    if (!isOwner) return res.status(403).json({ message: 'Forbidden: not your restaurant' });

    const globalStats = await tableSvc.getGlobalStats(restaurantId);
    const locationStats = await tableSvc.getStatsByLocation(restaurantId);
    
    // Trả về số liệu tổng hợp tương thích với frontend TableStats.jsx
    res.json({ 
      data: {
        total: globalStats.totalTables,
        available: globalStats.availableTables,
        occupied: globalStats.busyTables, 
        maintenance: globalStats.maintenanceTables,
        byLocation: locationStats
      }
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

module.exports = { list, create, update, remove, getStats };
