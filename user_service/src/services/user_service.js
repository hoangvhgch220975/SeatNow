const userSql = require('../models/user_sql');

async function getMe(userId) {
  const user = await userSql.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function updateMe(userId, payload) {
  const updated = await userSql.updateProfileById(userId, payload);
  if (!updated) throw Object.assign(new Error('User not found'), { status: 404 });
  return updated;
}

async function getMyBookings(userId, paging) {
  return await userSql.getBookingsByCustomerId(userId, paging);
}

async function getMyWallet(userId) {
  // nếu lúc register chưa tạo wallet thì tự tạo ở đây (mỗi user tối đa 1 wallet)
  return await userSql.ensureWalletForUser(userId);
}

async function getMyLoyaltyPoints(userId) {
  const points = await userSql.getLoyaltyPointsById(userId);
  if (points === null) throw Object.assign(new Error('User not found'), { status: 404 });
  return points;
}

module.exports = {
  getMe,
  updateMe,
  getMyBookings,
  getMyWallet,
  getMyLoyaltyPoints
};
