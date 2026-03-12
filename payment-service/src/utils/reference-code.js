// reference-code.js
// Mục đích: tạo mã tham chiếu ngắn, thân thiện với người dùng cho các giao dịch
// Ví dụ: REF-20260311-AB12

function generateReferenceCode(prefix = 'DEP') {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${yyyy}${mm}${dd}${rand}`;
}

module.exports = { generateReferenceCode };