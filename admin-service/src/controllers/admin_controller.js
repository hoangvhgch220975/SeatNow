const adminService = require('../services/admin_service');

// Tao nha hang qua admin-service, sau do forward sang restaurant-service.
async function createRestaurant(req, res, next) {
  try {
    const data = await adminService.createRestaurant({
      payload: req.body,
      authorization: req.headers.authorization
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Cap nhat nha hang qua admin-service.
async function updateRestaurant(req, res, next) {
  try {
    const data = await adminService.updateRestaurant({
      restaurantId: req.params.id,
      payload: req.body,
      authorization: req.headers.authorization
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Lay thong ke tong quan cho dashboard admin.
async function getStats(req, res, next) {
  try {
    const stats = await adminService.getStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// Lay danh sach nha hang dang cho duyet.
async function getPendingRestaurants(req, res, next) {
  try {
    const data = await adminService.getPendingRestaurants();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Duyet nha hang va tao vi neu can.
async function approveRestaurant(req, res, next) {
  try {
    const data = await adminService.approveRestaurant(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Tam ngung hoat dong nha hang.
async function suspendRestaurant(req, res, next) {
  try {
    const data = await adminService.suspendRestaurant(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Lay danh sach user theo bo loc va phan trang.
async function getUsers(req, res, next) {
  try {
    const data = await adminService.getUsers(req.query);
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// Lay danh sach booking theo bo loc admin.
async function getBookings(req, res, next) {
  try {
    const data = await adminService.getBookings(req.query);
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// Lay danh sach giao dich theo bo loc admin.
async function getTransactions(req, res, next) {
  try {
    const data = await adminService.getTransactions(req.query);
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// Chay doi soat commission theo quy, ho tro dry-run va real-run.
async function settleQuarterCommission(req, res, next) {
  try {
    const data = await adminService.settleQuarterCommission({
      year: req.body?.year,
      quarter: req.body?.quarter,
      adminUserId: req.body?.adminUserId,
      restaurantIds: req.body?.restaurantIds,
      dryRun: req.body?.dryRun,
      minAgeMinutes: req.body?.minAgeMinutes
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Admin duyệt yêu cầu rút tiền
async function approveWithdrawal(req, res, next) {
  try {
    const data = await adminService.approveWithdrawal(req.params.id, req.body, req.headers.authorization);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Admin từ chối yêu cầu rút tiền
async function rejectWithdrawal(req, res, next) {
  try {
    const data = await adminService.rejectWithdrawal(req.params.id, req.body, req.headers.authorization);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRestaurant,
  updateRestaurant,
  getStats,
  getPendingRestaurants,
  getUsers,
  getBookings,
  getTransactions,
  settleQuarterCommission,
  approveWithdrawal,
  rejectWithdrawal
};
