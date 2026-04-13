/**
 * restaurant.controller (placeholder)
 */
const restaurantSvc = require('../services/restaurant_service');

// Các trường chỉ ADMIN mới được thay đổi
const ADMIN_ONLY_FIELDS = ['status', 'isPremium', 'commissionRate'];

// Hàm liệt kê nhà hàng với phân trang và lọc
async function list(req, res) {
  try {
    const { rows, total } = await restaurantSvc.listRestaurants(req.query);
    res.json({ 
      data: rows, 
      total, 
      meta: { 
        limit: parseInt(req.query.limit || 20, 10), 
        offset: parseInt(req.query.offset || 0, 10) 
      } 
    });
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

// Hàm tạo mới một nhà hàng (ADMIN hoặc RESTAURANT_OWNER)
async function create(req, res) {
  try {
    const payload = { ...req.body };
    const role = req.user?.role;
    const userId = req.user?.sub || req.user?.id;

    if (role === 'RESTAURANT_OWNER') {
      // Nếu là Owner, bắt buộc ownerId là chính mình
      payload.ownerId = userId;
      // Mặc định là pending khi Owner tạo
      payload.status = 'pending';
      // Strip các trường nhạy cảm mà chỉ Admin mới được set khi tạo (commissionRate, isPremium...)
      for (const f of ADMIN_ONLY_FIELDS) {
        if (f !== 'status') delete payload[f]; 
      }
    } else if (role === 'ADMIN') {
      // Nếu là Admin, yêu cầu phải có ownerId (Admin tạo hộ cho ai đó)
      if (!payload.ownerId) {
        return res.status(400).json({ message: 'ownerId is required for Admin to create restaurant' });
      }
      // Nếu Admin tạo, nhà hàng sẽ Active luôn theo yêu cầu
      payload.status = 'active';
    }

    const data = await restaurantSvc.createRestaurant(payload);
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

    const existing = await restaurantSvc.getRestaurant(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    // Kiểm tra ownership nếu là RESTAURANT_OWNER
    if (role === 'RESTAURANT_OWNER') {
      if (existing.ownerId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: not your restaurant' });
      }
    }

    const data = await restaurantSvc.updateRestaurant(existing.id, payload);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

// Hàm cập nhật chính sách đặt cọc của nhà hàng
async function updateDepositPolicy(req, res) {
  try {
    const existing = await restaurantSvc.getRestaurant(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const role = req.user?.role;
    if (role === 'RESTAURANT_OWNER' && existing.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: not your restaurant' });
    }

    const data = await restaurantSvc.updateDepositPolicy(existing.id, req.body);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}
// Hàm xóa mềm nhà hàng
async function remove(req, res) {
  try {
    const existing = await restaurantSvc.getRestaurant(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const role = req.user?.role;
    if (role === 'RESTAURANT_OWNER' && existing.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: not your restaurant' });
    }

    const data = await restaurantSvc.softDeleteRestaurant(existing.id);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}


// Proxy availability sang booking-service de dung chung logic slot/table.
async function availability(req, res) {
  try {
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

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
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : '';
    const data = await restaurantSvc.getRevenueStats({
      restaurantId,
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

// Hàm lấy thống kê Portfolio tổng quát cho chủ sở hữu
async function portfolioSummary(req, res) {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : '';
    const data = await restaurantSvc.getOwnerPortfolioSummary({ token });
    res.json(data);
  } catch (e) {
    res.status(e.status || 400).json({ message: e.message });
  }
}

// Hàm lấy thống kê Summary cho duy nhất một nhà hàng
async function getRestaurantStatsSummary(req, res) {
  try {
    const restaurantId = await restaurantSvc.resolveId(req.params.id);
    if (!restaurantId) return res.status(404).json({ message: 'Restaurant not found' });

    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : '';
    const data = await restaurantSvc.getRestaurantStatsSummary(restaurantId, { token });
    res.json(data);
  } catch (e) {
    res.status(e.status || 400).json({ message: e.message });
  }
}

// Hàm lấy tất cả các nhà hàng thuộc sở hữu của Owner hiện tại
async function getPortfolioRestaurants(req, res) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Gọi tìm theo ownerId, hỗ trợ params paging
    const query = {
      ...req.query,
      ownerId,
      status: req.query.status || 'all',
      limit: req.query.limit || 50
    };
    
    const { rows, total } = await restaurantSvc.listRestaurants(query);
    res.json({
      data: rows,
      total,
      meta: {
        limit: parseInt(query.limit, 10),
        offset: parseInt(query.offset || 0, 10)
      }
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
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
  revenueStats,
  portfolioSummary,
  getRestaurantStatsSummary,
  getPortfolioRestaurants
};
