/**
 * geo.js - small geo helpers (placeholder)
 */

// Tính khoảng cách giữa hai điểm (lat1, lng1) và (lat2, lng2) theo công thức Haversine
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Tính bounding box (hình chữ nhật giới hạn) từ tâm (lat, lng) và bán kính (radiusKm)
function bboxFromRadius(lat, lng, radiusKm) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

module.exports = { haversineKm, bboxFromRadius };

