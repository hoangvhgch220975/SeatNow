const userService = require('../services/user_service');
const { getPagination } = require('../utils/pagination');
const { validateUpdateMe } = require('../validators/user_validator');

function pickUserId(req) {
  return req.user && req.user.id;
}

async function me(req, res) {
  try {
    const userId = pickUserId(req);
    const data = await userService.getMe(userId);
    res.json({ data });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || 'Server error' });
  }
}

async function updateMe(req, res) {
  try {
    const { value, error } = validateUpdateMe(req.body);
    if (error) return res.status(400).json({ message: 'Validation error', details: error.details });

    const userId = pickUserId(req);
    const data = await userService.updateMe(userId, value);
    res.json({ data });
  } catch (e) {
    // email unique có thể ném lỗi từ SQL Server → trả 409 cho dễ hiểu
    const msg = String(e.message || '');
    if (msg.includes('UQ_Users_email') || msg.includes('duplicate')) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(e.status || 500).json({ message: e.message || 'Server error' });
  }
}

async function myBookings(req, res) {
  try {
    const userId = pickUserId(req);
    const paging = getPagination(req.query);
    const data = await userService.getMyBookings(userId, paging);
    res.json({ paging: { page: paging.page, limit: paging.limit }, data });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || 'Server error' });
  }
}

async function myWallet(req, res) {
  try {
    const userId = pickUserId(req);
    const data = await userService.getMyWallet(userId);
    res.json({ data });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || 'Server error' });
  }
}

async function myLoyaltyPoints(req, res) {
  try {
    const userId = pickUserId(req);
    const points = await userService.getMyLoyaltyPoints(userId);
    res.json({ data: { loyaltyPoints: points } });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || 'Server error' });
  }
}

module.exports = { me, updateMe, myBookings, myWallet, myLoyaltyPoints };
