// money.js
// Mục đích: các hàm trợ giúp liên quan đến tiền—định dạng, làm tròn đến đơn vị tiền tệ nhỏ nhất,
// số học an toàn để tránh lỗi dấu phẩy động, chuyển đổi sang/từ đơn vị phụ (xu)

function normalizeAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Invalid amount');
  }
  return Number(n.toFixed(2));
}

module.exports = { normalizeAmount };