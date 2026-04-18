/**
 * restaurant.service (placeholder)
 * Implement search/detail logic using `models/*.sql.js` and caching.
  */
const restaurantSql = require('../models/restaurant_sql');
const { bboxFromRadius } = require('../utils/geo');
const { makeSlug } = require('../utils/slug');

// Helpers
function hasGeo(q) {
  const lat = parseFloat(q.lat);
  const lng = parseFloat(q.lng);
  return !isNaN(lat) && !isNaN(lng);
}

/**
 * Common helper to resolve restaurantId from either UUID or Slug.
 * If slug is provided, it performs a lookup in SQL.
 */
async function resolveId(idOrSlug) {
  if (!idOrSlug) return null;
  const isUuid = typeof idOrSlug === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);
  if (isUuid) return idOrSlug;

  const r = await restaurantSql.findBySlug(idOrSlug);
  return r ? r.id : null;
}

/**
 * list/search restaurants
 * - nếu có lat/lng + sort=distance -> near-me chuẩn (SQL ORDER BY distance + paging)
 * - còn lại -> search thường (rating/newest) + paging
 */

// Hàm liệt kê nhà hàng với các tùy chọn truy vấn
async function listRestaurants(query) {
  const geo = hasGeo(query);
  
  // Chỉ áp dụng giới hạn Bounding Box (bbox) nếu:
  // 1. Có yêu cầu bán kính cụ thể (radiusKm)
  // 2. Hoặc đang yêu cầu sắp xếp theo khoảng cách (Near Me mặc định)
  const shouldFilterByLocation = query.radiusKm || query.sort === 'distance';
  const nLat = parseFloat(query.lat);
  const nLng = parseFloat(query.lng);
  const nRadius = parseFloat(query.radiusKm || 5);

  const bbox = (geo && shouldFilterByLocation) 
    ? bboxFromRadius(nLat, nLng, nRadius) 
    : null;

  return restaurantSql.findMany({ 
    ...query, 
    bbox,
    radiusKm: shouldFilterByLocation ? (query.radiusKm || 5) : null 
  });
}

// Hàm lấy thông tin chi tiết của một nhà hàng dựa trên ID
async function getRestaurant(idOrSlug) {
  const finalId = await resolveId(idOrSlug);
  if (!finalId) return null;
  return restaurantSql.findById(finalId);
}


// Hàm tạo một nhà hàng mới - payload từ admin (bao gồm ownerId, commissionRate, status, ...)
async function createRestaurant(payload) {
  const slug = makeSlug(payload.name);
  const result = await restaurantSql.createRestaurant({ ...payload, slug });
  
  // Notify Admin
  try {
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
    fetch(notificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'web',
        payload: {
          role: 'ADMIN',
          event: 'RESTAURANT_CREATED',
          message: `New restaurant created: ${payload.name} (Pending Approval)`,
          link: '/audit-requests',
          data: {
            restaurantId: result.id || result.insertedId || null,
            name: payload.name
          }
        }
      })
    }).catch(err => console.error('Failed to notify admin of new restaurant:', err.message));
  } catch(e) {}
  
  return result;
}

// Hàm cập nhật thông tin của một nhà hàng dựa trên ID và payload
async function updateRestaurant(id, patch) {
  if (patch.slug) {
    // Ưu tiên slug thủ công nếu có gửi lên
    patch.slug = makeSlug(patch.slug);
  } else if (patch.name) {
    // Nếu không có slug nhưng có name, tự động sinh slug từ name
    patch.slug = makeSlug(patch.name);
  }
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

// Gọi booking-service để lấy portfolio summary cho chủ sở hữu
async function getOwnerPortfolioSummary({ token }) {
  const baseRaw = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004';
  const base = String(baseRaw).replace(/\/+$/, '');
  const apiBase = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  
  const url = `${apiBase}/owner/portfolio-summary`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(json?.message || `Portfolio summary request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }

  return json;
}

// Gọi booking-service để lấy summary lẻ cho một nhà hàng
async function getRestaurantStatsSummary(restaurantId, { token }) {
  const baseRaw = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004';
  const base = String(baseRaw).replace(/\/+$/, '');
  const apiBase = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  
  const url = `${apiBase}/restaurants/${restaurantId}/stats-summary`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(json?.message || `Restaurant stats summary request failed (${res.status})`);
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
  getRevenueStats,
  getOwnerPortfolioSummary,
  getRestaurantStatsSummary,
  resolveId
};


