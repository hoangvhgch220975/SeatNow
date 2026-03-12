// signature.js
// Tiện ích tạo chữ ký (HMAC) để đối chiếu callback/webhook từ cổng thanh toán.

const crypto = require('crypto');

// Tạo HMAC SHA256 và trả về dạng hex
function hmacSha256(secret, raw) {
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

// Tạo HMAC SHA512 và trả về dạng hex
function hmacSha512(secret, raw) {
  return crypto.createHmac('sha512', secret).update(raw).digest('hex');
}

// Sắp xếp key object theo thứ tự alphabet (phục vụ ký dữ liệu)
function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

// Chuyển object thành query string theo format key=value&...
function buildQueryString(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}`)
    .join('&');
}

module.exports = {
  hmacSha256,
  hmacSha512,
  sortObject,
  buildQueryString
};