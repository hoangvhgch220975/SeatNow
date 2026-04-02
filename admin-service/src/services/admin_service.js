const adminModel = require('../models/admin_sql');

// Tao loi HTTP de controller xu ly tap trung.
function createHttpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Chuan hoa so nguyen duong dung cho page, limit.
function normalizePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

// Chuan hoa danh sach id tu request body.
function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

// Chuyen cac gia tri thong dung ve boolean.
function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return Boolean(value);
}

// Tao thong tin phan trang mac dinh cho cac API list.
function buildPaging(query = {}, defaultLimit = 20) {
  const page = normalizePositiveInt(query.page, 1, { min: 1, max: 100000 });
  const limit = normalizePositiveInt(query.limit, defaultLimit, { min: 1, max: 100 });
  return { page, limit };
}

// Tao idempotency key cho doi soat commission theo quy.
function buildQuarterCommissionKey({ year, quarter, restaurantId }) {
  return `COMMISSION:Q${quarter}:${year}:${restaurantId}`;
}

// Lay base URL cua restaurant-service de goi gateway.
function getRestaurantServiceBaseUrl() {
  return (process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3003/api/v1').replace(/\/+$/, '');
}

// Goi HTTP JSON dung chung cho gateway create/update restaurant.
async function requestJson(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || `HTTP ${res.status} calling ${url}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

// Tao nha hang bang cach forward request sang restaurant-service.
async function createRestaurant({ payload, authorization }) {
  if (!payload || typeof payload !== 'object') throw createHttpError('payload is required', 422);

  const baseUrl = getRestaurantServiceBaseUrl();
  const result = await requestJson(
    'POST',
    `${baseUrl}/restaurants`,
    payload,
    authorization ? { Authorization: authorization } : {}
  );

  const newRest = result?.data ?? result;
  
  // Sau khi tạo thành công, nếu có ID và OwnerId thì tạo luôn Wallet (vì Admin tạo thì status=active)
  if (newRest && newRest.id && newRest.ownerId) {
    try {
      await adminModel.ensureRestaurantWallet(newRest.id, newRest.ownerId);
    } catch (err) {
      console.error(`Failed to ensure wallet for new restaurant ${newRest.id}:`, err.message);
      // Không throw lỗi ở đây để tránh rollback việc tạo nhà hàng, Admin có thể fix sau hoặc hệ thống retry.
    }
  }

  return newRest;
}

// Cap nhat nha hang bang cach forward request sang restaurant-service.
async function updateRestaurant({ restaurantId, payload, authorization }) {
  if (!restaurantId) throw createHttpError('restaurantId is required', 422);
  if (!payload || typeof payload !== 'object') throw createHttpError('payload is required', 422);

  const baseUrl = getRestaurantServiceBaseUrl();
  const result = await requestJson(
    'PUT',
    `${baseUrl}/restaurants/${restaurantId}`,
    payload,
    authorization ? { Authorization: authorization } : {}
  );

  return result?.data ?? result;
}

// Tao tai khoan chu nha hang thong qua auth-service
async function createRestaurantOwner({ payload, authorization }) {
  if (!payload || typeof payload !== 'object') throw createHttpError('payload is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await requestJson(
    'POST',
    `${authBaseUrl}/internal/users/restaurant-owner`,
    payload,
    headers
  );

  return result?.data ?? result;
}

// Admin reset mat khau cho restaurant owner
async function resetOwnerPassword({ ownerId, authorization }) {
  if (!ownerId) throw createHttpError('ownerId is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await requestJson(
    'POST',
    `${authBaseUrl}/internal/users/${ownerId}/reset-password`,
    {},
    headers
  );

  return result?.data ?? result;
}


// Lay thong ke dashboard tu SQL model.
async function getStats() {
  return adminModel.getDashboardStats();
}

// Lay thong ke doanh thu theo thoi gian cho admin
async function getAdminRevenueStats(query = {}) {
  return adminModel.getAdminRevenueStats({
    period: query.period,
    from: query.from,
    to: query.to
  });
}

// Lay danh sach nha hang dang pending.
async function getPendingRestaurants() {
  return adminModel.getPendingRestaurants();
}

// Duyet nha hang va dam bao nha hang co wallet de doi soat sau nay.
async function approveRestaurant(restaurantId) {
  const restaurant = await adminModel.getRestaurantById(restaurantId);
  if (!restaurant) throw createHttpError('Restaurant not found', 404);
  if (!restaurant.ownerId) throw createHttpError('Restaurant owner is required to create wallet', 409);

  await adminModel.approveRestaurant(restaurantId);
  const wallet = await adminModel.ensureRestaurantWallet(restaurantId, restaurant.ownerId);

  return {
    restaurantId,
    status: 'active',
    walletId: wallet?.id || null
  };
}

// Chuyen nha hang sang trang thai active (Mo khoa lai).
async function activateRestaurant(restaurantId) {
  const restaurant = await adminModel.getRestaurantById(restaurantId);
  if (!restaurant) throw createHttpError('Restaurant not found', 404);

  await adminModel.approveRestaurant(restaurantId);
  return {
    restaurantId,
    status: 'active'
  };
}

// Chuyen nha hang sang trang thai suspended.
async function suspendRestaurant(restaurantId) {
  const restaurant = await adminModel.getRestaurantById(restaurantId);
  if (!restaurant) throw createHttpError('Restaurant not found', 404);

  await adminModel.suspendRestaurant(restaurantId);
  return {
    restaurantId,
    status: 'suspended'
  };
}

// Lay danh sach user cho man hinh admin.
async function getUsers(query = {}) {
  const paging = buildPaging(query, 20);
  return adminModel.getUsers({
    role: query.role,
    keyword: query.keyword,
    ...paging
  });
}

// Lay danh sach booking cho admin.
async function getBookings(query = {}) {
  const paging = buildPaging(query, 20);
  return adminModel.getBookings({
    status: query.status,
    restaurantId: query.restaurantId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    ...paging
  });
}

// Lay danh sach giao dich cho admin.
async function getTransactions(query = {}) {
  const paging = buildPaging(query, 20);
  return adminModel.getTransactions({
    type: query.type,
    status: query.status,
    provider: query.provider,
    restaurantId: query.restaurantId,
    walletId: query.walletId,
    ...paging
  });
}

// Tinh moc thoi gian bat dau va ket thuc cua mot quy.
function quarterRange(year, quarter) {
  const q = Number(quarter);
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 3000) throw createHttpError('Invalid year', 422);
  if (![1, 2, 3, 4].includes(q)) throw createHttpError('Invalid quarter', 422);

  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(y, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, startMonth + 3, 1, 0, 0, 0, 0));
  return { start, end };
}

// Goi POST JSON dung chung cho booking-service va payment-service.
async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body || {})
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || `HTTP ${res.status} calling ${url}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

// Quy trinh doi soat commission theo quy:
// 1) Lay booking ung vien
// 2) Gom theo nha hang
// 3) Charge commission
// 4) Danh dau booking da thanh toan commission
async function settleQuarterCommission({ year, quarter, adminUserId, restaurantIds, dryRun, minAgeMinutes }) {
  if (!adminUserId) throw createHttpError('adminUserId is required', 422);

  const { start, end } = quarterRange(year, quarter);
  const bookingBase = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004/api/v1';
  const paymentBase = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005/api/v1/payment';
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

  const headers = internalToken ? { 'x-internal-token': internalToken } : {};
  const preview = await postJson(
    `${bookingBase}/internal/commissions/candidates`,
    {
      from: start.toISOString(),
      to: end.toISOString(),
      minAgeMinutes: Number(minAgeMinutes || 0),
      restaurantIds: normalizeIdList(restaurantIds)
    },
    headers
  );

  const items = preview?.data?.items || [];
  const group = new Map();
  for (const x of items) {
    const rid = String(x.restaurantId);
    if (!group.has(rid)) group.set(rid, []);
    group.get(rid).push(x);
  }

  const restaurants = [];
  let totalCharged = 0;
  let totalMarked = 0;
  const isDryRun = normalizeBoolean(dryRun);

  for (const [restaurantId, rows] of group.entries()) {
    const amount = rows.reduce((sum, x) => sum + Number(x.commissionFee || 0), 0);
    const bookingIds = rows.map((x) => x.id);
    const idempotencyKey = buildQuarterCommissionKey({ year, quarter, restaurantId });

    if (amount <= 0) {
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        idempotencyKey,
        status: 'skipped'
      });
      continue;
    }

    if (isDryRun) {
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        idempotencyKey,
        status: 'preview'
      });
      continue;
    }

    try {
      await postJson(
        `${paymentBase}/wallet/commission/charge`,
        {
          restaurantId,
          adminUserId,
          amount,
          description: `Quarterly commission settlement Q${quarter}/${year}`,
          idempotencyKey
        },
        headers
      );

      const marked = await postJson(
        `${bookingBase}/internal/commissions/mark-paid`,
        {
          bookingIds,
          settlementKey: idempotencyKey
        },
        headers
      );

      const markedCount = Number(marked?.data?.affectedCount || 0);
      totalCharged += amount;
      totalMarked += markedCount;
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        idempotencyKey,
        markedCount,
        status: 'settled'
      });
    } catch (e) {
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        idempotencyKey,
        status: 'failed',
        error: e.message
      });
    }
  }

  return {
    year: Number(year),
    quarter: Number(quarter),
    from: start.toISOString(),
    to: end.toISOString(),
    dryRun: isDryRun,
    candidateBookings: items.length,
    candidateRestaurants: group.size,
    totalCharged,
    restaurants
  };
}

// Admin duyệt yêu cầu rút tiền của nhà hàng
async function approveWithdrawal(transactionId, payload, authorization) {
  if (!transactionId) throw createHttpError('transactionId is required', 422);

  const paymentBase = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005/api/v1/payment';
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await postJson(
    `${paymentBase}/internal/wallet/withdraw/${transactionId}/approve`,
    payload,
    headers
  );

  return result?.data ?? result;
}

// Admin từ chối yêu cầu rút tiền của nhà hàng
async function rejectWithdrawal(transactionId, payload, authorization) {
  if (!transactionId) throw createHttpError('transactionId is required', 422);

  const paymentBase = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005/api/v1/payment';
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await postJson(
    `${paymentBase}/internal/wallet/withdraw/${transactionId}/reject`,
    payload,
    headers
  );

  return result?.data ?? result;
}

module.exports = {
  createRestaurant,
  updateRestaurant,
  getStats,
  getPendingRestaurants,
  approveRestaurant,
  activateRestaurant,
  suspendRestaurant,
  getBookings,
  getTransactions,
  settleQuarterCommission,
  approveWithdrawal,
  rejectWithdrawal,
  createRestaurantOwner,
  getAdminRevenueStats,
  resetOwnerPassword
};

