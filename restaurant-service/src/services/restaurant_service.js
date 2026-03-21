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


// Hàm tạo một nhà hàng mới - payload từ admin (bao gồm ownerId, commissionRate, status, ...)
async function createRestaurant(payload) {
  const slug = makeSlug(payload.name);
  return restaurantSql.createRestaurant({ ...payload, slug });
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

// Goi booking-service de lay availability theo nha hang.
async function getAvailability({ restaurantId, date, time, guests }) {
  if (!date || !time) {
    const e = new Error('date and time are required');
    e.status = 422;
    throw e;
  }

  const baseRaw = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004';
  const base = String(baseRaw).replace(/\/+$/, '');
  const apiBase = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  const qs = new URLSearchParams({
    date: String(date),
    time: String(time)
  });

  if (guests !== undefined && guests !== null && String(guests).length) {
    qs.set('guests', String(guests));
  }

  const url = `${apiBase}/restaurants/${restaurantId}/availability?${qs.toString()}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(json?.message || `Booking availability request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }

  return json;
}

// Gọi booking-service để lấy revenue stats
async function getRevenueStats({ restaurantId, period, from, to, token }) {
  const baseRaw = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004';
  const base = String(baseRaw).replace(/\/+$/, '');
  const apiBase = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  
  const qs = new URLSearchParams();
  if (period) qs.set('period', period);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);

  const url = `${apiBase}/restaurants/${restaurantId}/revenue-stats?${qs.toString()}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(json?.message || `Booking revenue stats request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }

  return json;
}

module.exports = {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  updateDepositPolicy,
  softDeleteRestaurant,
  getAvailability,
  getRevenueStats
};


