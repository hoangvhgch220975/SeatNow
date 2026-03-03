/**
 * booking.controller.js - HTTP handlers (placeholder)
 */
const bookingSvc = require('../services/booking_service');
const availabilitySvc = require('../services/availability_service');
const { createBookingSchema } = require('../validators/booking_validator');
const qrcode = require('qrcode');

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

    if (!bookingDate || !bookingTime) return res.status(422).json({ message: 'date and time are required' });

    const items = await availabilitySvc.getAvailableTables({ restaurantId, bookingDate, bookingTime, numGuests });
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

// Liệt kê booking của nhà hàng (dành cho owner/admin)
async function restaurantBookings(req, res) {
  try {
    const restaurantId = req.params.id;
    const paging = pickPaging(req.query, 50);

    const items = await bookingSvc.restaurantBookings(restaurantId, req.user, {
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
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

async function noShow(req, res) {
  try { return res.json({ booking: await bookingSvc.noShow(req.params.id) }); }
  catch (e) { return res.status(e.status || 400).json({ message: e.message }); }
}

module.exports = {
  create,
  availability,
  guestLookup,
  myBookings,
  restaurantBookings,
  confirm,
  arrived,
  complete,
  cancel,
  noShow
  ,
  getQr
};

