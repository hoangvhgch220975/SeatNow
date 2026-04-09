/**
 * booking.controller.js - HTTP handlers (placeholder)
 */
const bookingSvc = require('../services/booking_service');
const availabilitySvc = require('../services/availability_service');
const { createBookingSchema } = require('../validators/booking_validator');
const qrcode = require('qrcode');

function ensureInternalAccess(req) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected) return;
  const got = req.headers['x-internal-token'];
  if (got !== expected) {
    const e = new Error('Forbidden internal endpoint');
    e.status = 403;
    throw e;
  }
}

// Hàm lấy thông tin phân trang từ query parameters
function pickPaging(q, defLimit) {
  return {
    limit: parseInt(q.limit || String(defLimit), 10),
    offset: parseInt(q.offset || '0', 10)
  };
}

// Tạo booking mới
async function create(req, res) {
  const { error, value } = createBookingSchema.validate(req.body);
  if (error) return res.status(422).json({ message: error.message });

  try {
    const data = await bookingSvc.createBooking({ actor: req.user || null, body: value });
    // include a simple QR URL (frontend can generate QR from this or server can provide image)
    try {
      const checkinUrl = `${process.env.APP_BASE_URL || ''}/checkin?bookingId=${data.booking.id}`;
      data.booking.checkinUrl = checkinUrl;
    } catch (e) {}
    return res.status(201).json(data);
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Return QR image (PNG) for booking check-in - owner/admin only (route protects with requireRole)
async function getQr(req, res) {
  try {
    const id = req.params.id;
    // payload: plain bookingId URL for owner app to scan
    const payload = `${process.env.APP_BASE_URL || ''}/checkin?bookingId=${id}`;
    const buffer = await qrcode.toBuffer(payload, { type: 'png', width: 300 });
    res.setHeader('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

// Kiểm tra khả năng đặt bàn
async function availability(req, res) {
  try {
    const restaurantId = req.params.id;
    const bookingDate = req.query.date;
    const bookingTime = req.query.time;
    const numGuests = parseInt(req.query.guests || '1', 10);
    const forceRefresh = req.query.refresh === 'true';

    if (!bookingDate || !bookingTime) return res.status(422).json({ message: 'date and time are required' });

    const items = await availabilitySvc.getAvailableTables({ restaurantId, bookingDate, bookingTime, numGuests, forceRefresh });
    return res.json({ items });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

// Tra cứu booking cho khách (guest)
async function guestLookup(req, res) {
  const { bookingCode } = req.query;
  let guestPhone = req.query.guestPhone || req.query.phone;
  if (!bookingCode || !guestPhone) return res.status(422).json({ message: 'bookingCode and guestPhone are required' });

  // Normalize phone: remove spaces and try both + and non-plus variants
  const norm = guestPhone.toString().trim().replace(/\s+/g, '');
  const candidates = [];
  if (norm.startsWith('+')) {
    candidates.push(norm);
    candidates.push(norm.replace(/^\+/, ''));
  } else {
    candidates.push(norm);
    candidates.push('+' + norm);
  }


  let booking = null;
  for (const gp of candidates) {
    booking = await bookingSvc.guestLookup({ bookingCode, guestPhone: gp });
    if (booking) break;
  }

  if (!booking) return res.status(404).json({ message: 'Not found' });

  return res.json({ booking });
}

// Liệt kê booking của khách hàng (customer)
async function myBookings(req, res) {
  try {
    const paging = pickPaging(req.query, 20);
    const items = await bookingSvc.myBookings(req.user, paging);
    return res.json({ items, ...paging });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

// Get booking details with access control
async function getBooking(req, res) {
  try {
    const id = req.params.id;
    const details = await bookingSvc.getBookingDetails(id);
    if (!details || !details.booking) return res.status(404).json({ message: 'Not found' });

    const { booking, restaurant } = details;
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (user.role === 'ADMIN') return res.json({ booking, restaurant });

    if (user.role === 'CUSTOMER') {
      if (!booking.customerId || String(booking.customerId) !== String(user.id)) return res.status(403).json({ message: 'Forbidden' });
      return res.json({ booking, restaurant });
    }

    if (user.role === 'RESTAURANT_OWNER') {
      if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
      if (String(restaurant.ownerId) !== String(user.id)) return res.status(403).json({ message: 'Forbidden' });
      return res.json({ booking, restaurant });
    }

    return res.status(403).json({ message: 'Forbidden' });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

// Liệt kê booking của nhà hàng (dành cho owner/admin)
async function restaurantBookings(req, res) {
  try {
    const restaurantId = req.params.id;
    const paging = pickPaging(req.query, 50);

    const items = await bookingSvc.restaurantBookings(restaurantId, req.user, {
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
      sort: req.query.sort,
      ...paging
    });

    return res.json({ items, ...paging });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Các hành động thay đổi trạng thái booking
async function confirm(req, res) {
  try { return res.json({ booking: await bookingSvc.confirm(req.params.id) }); }
  catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

async function arrived(req, res) {
  try { return res.json({ booking: await bookingSvc.arrived(req.params.id) }); }
  catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

async function complete(req, res) {
  try { return res.json({ booking: await bookingSvc.complete(req.params.id) }); }
  catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

async function cancel(req, res) {
  try {
    const reason = req.body && req.body.cancellationReason ? req.body.cancellationReason : null;
    console.log('[Cancel] req.user:', req.user);
    console.log('[Cancel] reason:', reason);
    const result = await bookingSvc.cancel(req.params.id, req.user || null, reason);
    return res.json({ booking: result });
  } catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

async function guestCancel(req, res) {
  try {
    const guestPhone = req.body && req.body.guestPhone ? req.body.guestPhone : null;
    if (!guestPhone) {
      return res.status(400).json({ message: 'Guest phone number is required for verification' });
    }
    const reason = req.body && req.body.cancellationReason ? req.body.cancellationReason : null;
    const result = await bookingSvc.guestCancel(req.params.id, guestPhone, reason);
    return res.json({ booking: result });
  } catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

async function modify(req, res) {
  try {
    const id = req.params.id;
    const result = await bookingSvc.modifyBooking({
      id,
      actor: req.user || null,
      body: req.body
    });
    return res.json(result);
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

async function noShow(req, res) {
  try { return res.json({ booking: await bookingSvc.noShow(req.params.id) }); }
  catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

// Kiểm tra tình trạng đặt cọc (payment status)
async function paymentStatus(req, res) {
  try {
    const bookingId = req.params.id;
    const status = await bookingSvc.getPaymentStatus(bookingId);
    return res.json(status);
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Tổng hợp commission theo nhà hàng
async function commissionSummary(req, res) {
  try {
    const restaurantId = req.params.id;
    const data = await bookingSvc.commissionSummary(restaurantId, req.user, {
      from: req.query.from,
      to: req.query.to
    });
    return res.json({ restaurantId, ...data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Thống kê doanh thu theo nhà hàng
async function revenueStatistics(req, res) {
  try {
    let { from, to, period } = req.query;
    
    // Chuẩn hóa: Nếu là chuỗi rỗng thì coi như undefined
    if (from === '') from = undefined;
    if (to === '') to = undefined;

    // Auto-fill from/to if missing but period is provided
    if (period && (!from || !to)) {
      const now = new Date();
      if (!from && !to) {
        if (period === 'week') {
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          from = `${now.getFullYear()}-${month}-01`;
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          to = `${now.getFullYear()}-${month}-${lastDay}`;
        } else if (period === 'month') {
          from = `${now.getFullYear()}-01-01`;
          to = `${now.getFullYear()}-12-31`;
        }
      } else if (!to) {
        to = now.toISOString().split('T')[0];
      } else if (!from) {
        from = '2000-01-01';
      }
    }


    const restaurantId = req.params.id;
    const data = await bookingSvc.getRevenueStatistics(restaurantId, req.user, {
      period,
      from,
      to
    });
    return res.json({ restaurantId, from, to, data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Thống kê Summary cho DUY NHẤT một nhà hàng
async function restaurantStatsSummary(req, res) {
  try {
    const restaurantId = req.params.id;
    const { from, to } = req.query;
    const data = await bookingSvc.getRestaurantStatsSummary(restaurantId, req.user, { from, to });
    return res.json({ data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Thống kê Portfolio cho Chủ chuỗi nhà hàng (Global Summary)
async function portfolioSummary(req, res) {
  try {
    const { from, to } = req.query;
    const data = await bookingSvc.getOwnerPortfolioSummary(req.user, { from, to });
    return res.json({ data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Thống kê Doanh thu và Đơn đặt bàn Portfolio cho chủ (Timeline)
async function portfolioRevenueStatistics(req, res) {
  try {
    let { from, to, period } = req.query;

    if (period && !from && !to) {
      const now = new Date();
      if (period === 'week') {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (period === 'month') {
        from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      }
    }

    const data = await bookingSvc.getOwnerRevenueStatistics(req.user, {
      period,
      from,
      to
    });
    return res.json({ data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Thống kê phân bổ giờ đặt bàn cho một nhà hàng
async function getHourlyStats(req, res) {
  try {
    const restaurantId = req.params.id;
    const { from, to, period } = req.query;
    let effectiveFrom = from;
    let effectiveTo = to;

    if (period && !from && !to) {
      const now = new Date();
      if (period === 'week') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        effectiveFrom = new Date(d.setDate(diff)).toISOString().split('T')[0];
      } else if (period === 'month') {
        effectiveFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      } else if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        effectiveFrom = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
      } else if (period === 'year') {
        effectiveFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      }
      effectiveTo = now.toISOString().split('T')[0];
    }

    const data = await bookingSvc.getHourlyBookingStats(restaurantId, req.user, {
      from: effectiveFrom,
      to: effectiveTo
    });
    return res.json({ restaurantId, from: effectiveFrom, to: effectiveTo, data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Thống kê phân bổ giờ đặt bàn Portfolio cho chủ (aggregated)
async function getOwnerHourlyStats(req, res) {
  try {
    const { from, to, period } = req.query;
    let effectiveFrom = from;
    let effectiveTo = to;

    if (period && !from && !to) {
      const now = new Date();
      if (period === 'week') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        effectiveFrom = new Date(d.setDate(diff)).toISOString().split('T')[0];
      } else if (period === 'month') {
        effectiveFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      } else if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        effectiveFrom = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
      } else if (period === 'year') {
        effectiveFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      }
      effectiveTo = now.toISOString().split('T')[0];
    }

    const data = await bookingSvc.getOwnerHourlyBookingStats(req.user, {
      from: effectiveFrom,
      to: effectiveTo
    });
    return res.json({ from: effectiveFrom, to: effectiveTo, data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Chốt thu commission theo kỳ
async function settleCommission(req, res) {
  try {
    const restaurantId = req.params.id;
    const data = await bookingSvc.settleCommission(restaurantId, req.user, {
      from: req.body?.from ?? req.query?.from,
      to: req.body?.to ?? req.query?.to,
      minAgeMinutes: req.body?.minAgeMinutes ?? req.query?.minAgeMinutes
    });
    return res.json({ restaurantId, ...data });
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message });
  }
}

// Internal: lay danh sach booking commission chua thu.
async function internalCommissionCandidates(req, res) {
  try {
    ensureInternalAccess(req);
    const data = await bookingSvc.getCommissionCandidatesInternal({
      from: req.body?.from ?? req.query?.from,
      to: req.body?.to ?? req.query?.to,
      minAgeMinutes: req.body?.minAgeMinutes ?? req.query?.minAgeMinutes,
      restaurantIds: req.body?.restaurantIds
    });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(e.status || 400).json({ success: false, message: e.message });
  }
}

// Internal: mark commissionPaid=1 cho booking charge thanh cong.
async function internalMarkCommissionPaid(req, res) {
  try {
    ensureInternalAccess(req);
    const data = await bookingSvc.markCommissionPaidInternal({
      bookingIds: req.body?.bookingIds
    });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(e.status || 400).json({ success: false, message: e.message });
  }
}

// Internal: trigger socket cho payment success
async function internalPaymentSuccess(req, res) {
  try {
    ensureInternalAccess(req);
    const data = await bookingSvc.paymentSuccess(req.params.id);
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(e.status || 400).json({ success: false, message: e.message });
  }
}

module.exports = {
  create,
  availability,
  guestLookup,
  myBookings,
  getBooking,
  restaurantBookings,
  confirm,
  arrived,
  complete,
  cancel,
  guestCancel,
  modify,
  noShow,
  paymentStatus,
  commissionSummary,
  settleCommission,
  internalCommissionCandidates,
  internalMarkCommissionPaid,
  internalPaymentSuccess,
  getQr,
  revenueStatistics,
  portfolioSummary,
  portfolioRevenueStatistics,
  restaurantStatsSummary,
  getHourlyStats,
  getOwnerHourlyStats
};

