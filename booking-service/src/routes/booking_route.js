const express = require('express');
const c = require('../controllers/booking_controller');

const jwt = require('../middlewares/jwt_middleware');
const optionalAuth = require('../middlewares/optionalAuth_middleware');
const requireRole = require('../middlewares/requireRole_middleware');
const rateLimit = require('../middlewares/rateLimit_middleware');

const r = express.Router();

// =====================================================
// Routing cho Booking - Một file duy nhất, chia theo phân quyền (role)
// =====================================================

// --- Public / Khách vãng lai (Guest) ---------------------------------
// Tạo booking (dành cho khách vãng lai hoặc khách hàng đã đăng nhập)
r.post('/bookings', optionalAuth, rateLimit({ limit: 10, windowSec: 60, key: 'create_booking' }), c.create);

// Khách vãng lai tra cứu: tìm booking bằng email/sđt + mã booking
r.get('/bookings/guest/lookup', c.guestLookup);

// Kiểm tra bàn trống (public)
r.get('/restaurants/:id/availability', rateLimit({ limit: 60, windowSec: 60, key: 'availability' }), c.availability);

// Khách vãng lai hủy booking (không yêu cầu xác thực khách hàng)
r.put('/bookings/:id/cancel/guest', optionalAuth, rateLimit({ limit: 10, windowSec: 60, key: 'guest_cancel' }), c.cancel);

// Kiểm tra tình trạng đặt cọc (khách vãng lai/khách hàng/chủ nhà hàng)
r.get('/bookings/:id/payment-status', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.paymentStatus);

// --- Khách hàng (Customer) --------------------------------------
// Danh sách booking của khách hàng đang đăng nhập
r.get('/bookings/my-bookings', jwt.requireAuth, requireRole('CUSTOMER'), c.myBookings);

// Chi tiết booking: khách hàng, chủ nhà hàng và admin dùng chung endpoint
// Controller sẽ tự kiểm tra quyền sở hữu/role
r.get('/bookings/:id', jwt.requireAuth, c.getBooking);

// Hủy booking (Khách hàng tự hủy, hoặc Chủ nhà hàng/Admin hủy)
r.put('/bookings/:id/cancel', jwt.requireAuth, requireRole('CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN'), c.cancel);

// --- Chủ nhà hàng / Admin (Owner / Admin) ---------------------------------
// Danh sách booking của một nhà hàng (dành cho chủ nhà hàng/admin)
r.get('/restaurants/:id/bookings', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.restaurantBookings);

// Tổng hợp/chốt tiền hoa hồng (dành cho chủ nhà hàng/admin)
r.get('/restaurants/:id/commissions/summary', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.commissionSummary);
r.post('/restaurants/:id/commissions/settle', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.settleCommission);

// Thống kê doanh thu (dành cho chủ nhà hàng/admin)
r.get('/restaurants/:id/revenue-stats', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.revenueStatistics);

// Các thao tác của Chủ nhà hàng/Admin trên booking
r.put('/bookings/:id/confirm', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.confirm);
r.put('/bookings/:id/arrived', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.arrived);
r.put('/bookings/:id/complete', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.complete);
r.put('/bookings/:id/no-show', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.noShow);

// Lấy mã QR để check-in (dành cho chủ nhà hàng/admin)
r.get('/bookings/:id/qr', jwt.requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), c.getQr);

// --- Các endpoint nội bộ (admin-service gọi sang) ---
r.post('/internal/commissions/candidates', c.internalCommissionCandidates);
r.post('/internal/commissions/mark-paid', c.internalMarkCommissionPaid);

// Endpoint nội bộ được payment-service gọi sau khi khách đặt cọc thành công
r.post('/internal/bookings/:id/payment-success', c.internalPaymentSuccess);

module.exports = r;
