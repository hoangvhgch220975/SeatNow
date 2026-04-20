const adminService = require('../services/admin_service');

// Tao tai khoan chu nha hang
async function createRestaurantOwner(req, res, next) {
  try {
    const data = await adminService.createRestaurantOwner({
      payload: req.body,
      authorization: req.headers.authorization
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Admin reset mat khau chu nha hang
async function resetOwnerPassword(req, res, next) {
  try {
    const data = await adminService.resetOwnerPassword({
      ownerId: req.params.id,
      payload: req.body,
      authorization: req.headers.authorization
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Cap nhat thong tin user (Admin)
async function updateUser(req, res, next) {
  try {
    const data = await adminService.updateUser({
      userId: req.params.id,
      payload: req.body,
      authorization: req.headers.authorization
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Xoa user (Admin)
async function deleteUser(req, res, next) {
  try {
    const data = await adminService.deleteUser({
      userId: req.params.id,
      authorization: req.headers.authorization
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

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
    const stats = await adminService.getStats(req.query);
    return res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// Lay thong ke doanh thu cho admin theo thoi gian.
async function getAdminRevenueStats(req, res, next) {
  try {
    const data = await adminService.getAdminRevenueStats(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Lay danh sach tat ca nha hang voi bo loc admin (tim kiem ten, id owner...).
async function getRestaurants(req, res, next) {
  try {
    const data = await adminService.getRestaurants(req.query);
    return res.json({ success: true, ...data });
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

// Mo khoa lai nha hang.
async function activateRestaurant(req, res, next) {
  try {
    const data = await adminService.activateRestaurant(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Tu choi nha hang (Hard Delete neu dang pending)
async function rejectRestaurant(req, res, next) {
  try {
    const data = await adminService.rejectRestaurant(req.params.id);
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

// Thu phi hoa hong linh hoat (Manual Collect)
async function collectCommissions(req, res, next) {
  try {
    const { from, to, restaurantIds, dryRun, minAgeMinutes, description, adminUserId } = req.body;
    
    // Su dung adminUserId tu body hoac tu token neu co
    const effectiveAdminUserId = adminUserId || req.user?.id;

    const result = await adminService.collectCommissions({
      from,
      to,
      adminUserId: effectiveAdminUserId,
      restaurantIds,
      dryRun,
      minAgeMinutes,
      description: description || 'Manual commission collection',
      contextKey: `manual:${Date.now()}`
    });

    return res.json({ success: true, data: result });
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

// Lấy danh sách partner requests
async function getPartnerRequests(req, res, next) {
  try {
    const data = await adminService.getPartnerRequests(req.query, req.headers.authorization);
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// Duyệt partner request
async function approvePartnerRequest(req, res, next) {
  try {
    const data = await adminService.approvePartnerRequest(req.params.id, req.body, req.headers.authorization);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Từ chối partner request
async function rejectPartnerRequest(req, res, next) {
  try {
    const data = await adminService.rejectPartnerRequest(req.params.id, req.headers.authorization);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Lấy danh sách yêu cầu rút tiền cho Admin quản lý.
async function getWithdrawals(req, res, next) {
  try {
    const data = await adminService.getWithdrawals(req.query);
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRestaurantOwner,
  createRestaurant,
  updateRestaurant,
  getStats,
  getPendingRestaurants,
  approveRestaurant,
  activateRestaurant,
  suspendRestaurant,
  rejectRestaurant,
  getUsers,
  getBookings,
  getTransactions,
  settleQuarterCommission,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawals,
  getAdminRevenueStats,
  resetOwnerPassword,
  getPartnerRequests,
  approvePartnerRequest,
  rejectPartnerRequest,
  getRestaurants,
  collectCommissions,
  updateUser,
  deleteUser
};
