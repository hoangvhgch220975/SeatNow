/**
 * restaurant.service (placeholder)
 * Implement search/detail logic using `models/*.sql.js` and caching.
  */
const restaurantSql = require('../models/restaurant_sql');
const { bboxFromRadius } = require('../utils/geo');
const { makeSlug } = require('../utils/slug');

// Helpers
function hasGeo(q) {
  return typeof q.lat === 'number' && typeof q.lng === 'number';
}

/**
 * list/search restaurants
 * - nếu có lat/lng + sort=distance -> near-me chuẩn (SQL ORDER BY distance + paging)
 * - còn lại -> search thường (rating/newest) + paging
 */

// Hàm liệt kê nhà hàng với các tùy chọn truy vấn
async function listRestaurants(query) {
  const geo = hasGeo(query);
  const bbox = geo ? bboxFromRadius(query.lat, query.lng, query.radiusKm || 5) : null;

  if (geo && query.sort === 'distance') {
    return restaurantSql.findManyNearMe({ ...query, bbox });
  }
  return restaurantSql.findMany({ ...query, bbox });
}

// Hàm lấy thông tin chi tiết của một nhà hàng dựa trên ID
async function getRestaurant(id) {
  // Accept either UUID id or slug
  const isUuid = typeof id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
  if (isUuid) return restaurantSql.findById(id);
  return restaurantSql.findBySlug(id);
}


// Hàm tạo một nhà hàng mới với thông tin từ payload
async function createRestaurant(ownerId, payload) {
  const slug = makeSlug(payload.name);
  return restaurantSql.createRestaurant({ ...payload, ownerId, slug });
}

// Hàm cập nhật thông tin của một nhà hàng dựa trên ID và payload
async function updateRestaurant(id, patch) {
  if (patch.name) patch.slug = makeSlug(patch.name);
  return restaurantSql.updateRestaurant(id, patch);
}

// Hàm cập nhật chính sách đặt cọc của nhà hàng
async function updateDepositPolicy(id, payload) {
  const { depositEnabled } = payload || {};
  const policy = (payload && (payload.policy ?? payload.depositPolicy)) || null;
  return restaurantSql.updateDepositPolicy(id, { depositEnabled, policy });
}

// Hàm xóa mềm nhà hàng dựa trên ID
async function softDeleteRestaurant(id) {
  return restaurantSql.softDelete(id);
}

module.exports = {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  updateDepositPolicy,
  softDeleteRestaurant
};


