const adminModel = require('../models/admin_sql');

// Create HTTP error for centralized controller handling.
function createHttpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Normalize positive integer for pagination (page, limit).
function normalizePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

// Normalize ID list from request body.
function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

// Convert common values to boolean.
function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return Boolean(value);
}

// Build default paging info for list APIs.
function buildPaging(query = {}, defaultLimit = 20) {
  const page = normalizePositiveInt(query.page, 1, { min: 1, max: 100000 });
  const limit = normalizePositiveInt(query.limit, defaultLimit, { min: 1, max: 100 });
  return { page, limit };
}

// Create idempotency key for quarterly commission settlement.
function buildQuarterCommissionKey({ year, quarter, restaurantId }) {
  return `COMMISSION:Q${quarter}:${year}:${restaurantId}`;
}

// Get restaurant-service base URL for gateway calls.
function getRestaurantServiceBaseUrl() {
  return (process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3003/api/v1').replace(/\/+$/, '');
}

// Common JSON HTTP request helper for gateway calls.
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

// Create restaurant by forwarding request to restaurant-service.
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
      // Do not throw error here to avoid rolling back restaurant creation; Admin can fix it later or system can retry.
    }
  }

  return newRest;
}

// Update restaurant by forwarding request to restaurant-service.
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

// Create restaurant owner account via auth-service
async function createRestaurantOwner({ payload, authorization }) {
  if (!payload || typeof payload !== 'object') throw createHttpError('payload is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
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

// Admin reset password for restaurant owner
async function resetOwnerPassword({ ownerId, payload, authorization }) {
  if (!ownerId) throw createHttpError('ownerId is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await requestJson(
    'POST',
    `${authBaseUrl}/internal/users/${ownerId}/reset-password`,
    payload,
    headers
  );

  return result?.data ?? result;
}

// Cap nhat thong tin user (Owner)
async function updateUser({ userId, payload, authorization }) {
  if (!userId) throw createHttpError('userId is required', 422);
  if (!payload || typeof payload !== 'object') throw createHttpError('payload is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await requestJson(
    'PUT',
    `${authBaseUrl}/internal/users/${userId}`,
    payload,
    headers
  );

  return result?.data ?? result;
}

// Xoa cung user (Owner)
async function deleteUser({ userId, authorization }) {
  if (!userId) throw createHttpError('userId is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await requestJson(
    'DELETE',
    `${authBaseUrl}/internal/users/${userId}`,
    undefined,
    headers
  );

  return result?.data ?? result;
}


// Lay thong ke dashboard tu SQL model.
async function getStats(query = {}) {
  const { from, to, period, restaurantId } = query;
  let dateFrom = from;
  let dateTo = to;

  if (period) {
    const range = getPeriodRange(period);
    dateFrom = range.from;
    dateTo = range.to;
  }

  return adminModel.getDashboardStats({ dateFrom, dateTo, restaurantId });
}

// Helper: Chuyen doi period thanh khoang ngay bat dau va ket thuc.
function getPeriodRange(period) {
  const now = new Date();
  const from = new Date();
  const to = new Date();

  // Reset gio/phut/giay ve dau/cuoi ngay.
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  switch (period.toLowerCase()) {
    case 'today':
      break;
    case 'this_week':
    case 'week':
      // Lay ngay dau tuan (giả sử Thứ 2).
      const day = from.getDay();
      const diff = from.getDate() - day + (day === 0 ? -6 : 1);
      from.setDate(diff);
      break;
    case 'this_month':
    case 'month':
      from.setDate(1);
      break;
    case 'quarterly':
    case 'quarter':
      const currentMonth = from.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      from.setMonth(quarterStartMonth, 1);
      break;
    case 'yearly':
    case 'year':
      from.setMonth(0, 1);
      break;
  }

  return { from, to };
}

// Lay thong ke doanh thu theo thoi gian cho admin
async function getAdminRevenueStats(query = {}) {
  const { period, from, to } = query;
  let dateFrom = from;
  let dateTo = to;

  if (period && (!dateFrom || !dateTo)) {
    const range = getPeriodRange(period);
    dateFrom = range.from;
    dateTo = range.to;
  }

  return adminModel.getAdminRevenueStats({
    period: period || 'month',
    from: dateFrom,
    to: dateTo
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

  // Lấy thông tin email và tên của chủ nhà hàng để gửi thông báo
  try {
    const owner = await adminModel.getUserAuthById(restaurant.ownerId);
    if (owner && owner.email) {
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      
      // Gửi email thông báo kích hoạt nhà hàng thành công
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          payload: {
            to: owner.email,
            templateType: 'restaurant_activated',
            data: {
              ownerName: owner.fullName || owner.name || 'Owner',
              restaurantName: restaurant.name
            }
          }
        })
      }).catch(err => console.error('Failed to notify owner of restaurant activation:', err.message));

      // Gửi Web notification (Real-time)
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          payload: {
            userId: restaurant.ownerId,
            restaurantId: restaurant.id,
            title: 'Congratulations! Your restaurant has been approved',
            message: `Your restaurant "${restaurant.name}" has been approved by Admin and is now ready for operations.`,
            link: '/restaurant/settings',
            event: 'RESTAURANT_APPROVED'
          }
        })
      }).catch(() => {});
    }
  } catch (notifyErr) {
    console.warn('Non-blocking error during owner notification:', notifyErr.message);
  }

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

  // Gửi email thông báo mở khóa cho chủ nhà hàng (ví đã tồn tại, không tạo lại)
  try {
    const owner = await adminModel.getUserAuthById(restaurant.ownerId);
    if (owner && owner.email) {
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          payload: {
            to: owner.email,
            templateType: 'restaurant_reactivated',
            data: {
              ownerName: owner.fullName || owner.name || 'Owner',
              restaurantName: restaurant.name
            }
          }
        })
      }).catch(err => console.error('Failed to notify owner of restaurant reactivation:', err.message));

      // Gửi Web notification (Real-time)
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          payload: {
            userId: restaurant.ownerId,
            restaurantId: restaurant.id,
            title: 'Restaurant Activated',
            message: `Your restaurant "${restaurant.name}" has been activated by Admin.`,
            link: '/restaurant/settings',
            event: 'RESTAURANT_ACTIVATED'
          }
        })
      }).catch(() => {});
    }
  } catch (notifyErr) {
    console.warn('Non-blocking error during owner reactivation notification:', notifyErr.message);
  }

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
  
  // Thông báo khóa nhà hàng
  try {
    const owner = await adminModel.getUserAuthById(restaurant.ownerId);
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
    
    // 1. Gửi Email (Nếu có email)
    if (owner && owner.email) {
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          payload: {
            to: owner.email,
            subject: `[SeatNow] Restaurant "${restaurant.name}" has been suspended`,
            html: `<p>Dear ${owner.fullName || 'Owner'},</p><p>Your restaurant <b>${restaurant.name}</b> has been suspended by Admin. Please contact support for more details.</p>`
          }
        })
      }).catch(() => {});
    }

    // 2. Gửi Web Notification
    await fetch(notificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'web',
        payload: {
          userId: restaurant.ownerId,
          restaurantId: restaurant.id,
          title: 'Restaurant Suspended',
          message: `Your restaurant "${restaurant.name}" has been suspended by Admin.`,
          link: '/restaurant/settings',
          event: 'RESTAURANT_SUSPENDED'
        }
      })
    }).catch(() => {});

  } catch (notifyErr) {
    console.warn('Non-blocking error during owner suspension notification:', notifyErr.message);
  }

  return {
    restaurantId,
    status: 'suspended'
  };
}

// Lay tat ca nha hàng (dung SQL de JOIN thong tin owner)
async function getRestaurants(query = {}) {
  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || '20', 10);

  return adminModel.getRestaurants({
    q: query.q,
    status: query.status,
    ownerId: query.ownerId,
    page,
    limit,
    sort: query.sort
  });
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
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
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
// Ham dung chung thuc hien thu phi hoa hong cho mot tap hop cac don hang.
async function collectCommissions({ from, to, adminUserId, restaurantIds, dryRun, minAgeMinutes, description, contextKey }) {
  if (!adminUserId) throw createHttpError('adminUserId is required', 422);

  const bookingBase = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004/api/v1';
  const paymentBase = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005/api/v1/payment';
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  // 1) Lay cac don hang ung vien de thu phi
  const candidatesResponse = await postJson(
    `${bookingBase}/internal/commissions/candidates`,
    {
      from: from instanceof Date ? from.toISOString() : from,
      to: to instanceof Date ? to.toISOString() : to,
      minAgeMinutes: Number(minAgeMinutes || 0),
      restaurantIds: normalizeIdList(restaurantIds)
    },
    headers
  );

  const items = candidatesResponse?.data?.items || [];
  const group = new Map();
  for (const x of items) {
    const rid = String(x.restaurantId);
    if (!group.has(rid)) group.set(rid, []);
    group.get(rid).push(x);
  }

  const results = [];
  let totalChargedOverall = 0;
  let totalMarkedOverall = 0;
  const isDryRun = normalizeBoolean(dryRun);

  for (const [restaurantId, rows] of group.entries()) {
    const amount = rows.reduce((sum, x) => sum + Number(x.commissionFee || 0), 0);
    const bookingIds = rows.map((x) => x.id);
    
    // Tao idempotency key neu khong truyen vao
    const idempotencyKey = contextKey ? `coll:${contextKey}:${restaurantId}` : `coll:auto:${Date.now()}:${restaurantId}`;

    if (amount <= 0) {
      results.push({ restaurantId, bookingCount: rows.length, amount, status: 'skipped' });
      continue;
    }

    if (isDryRun) {
      results.push({ restaurantId, bookingCount: rows.length, amount, status: 'preview' });
      continue;
    }

    try {
      // 2) Charge tien tu vi nha hang
      await postJson(
        `${paymentBase}/wallet/commission/charge`,
        {
          restaurantId,
          adminUserId,
          amount,
          description: description || 'Commission settlement',
          idempotencyKey
        },
        headers
      );

      // 3) Danh dau cac don hang nay da thanh toan phi
      const markResponse = await postJson(
        `${bookingBase}/internal/commissions/mark-paid`,
        {
          bookingIds,
          settlementKey: idempotencyKey
        },
        headers
      );

      const markedCount = Number(markResponse?.data?.affectedCount || 0);
      totalChargedOverall += amount;
      totalMarkedOverall += markedCount;
      
      results.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        markedCount,
        status: 'settled'
      });

      // 4) Thong bao cho chu nha hang (Optional/Async)
      notifyOwnerCommissionSettled(restaurantId, amount).catch(console.error);

    } catch (err) {
      console.error(`Failed to settle commission for restaurant ${restaurantId}:`, err.message);
      results.push({ restaurantId, amount, status: 'error', error: err.message });
    }
  }

  return {
    totalCharged: totalChargedOverall,
    totalMarked: totalMarkedOverall,
    restaurants: results
  };
}

// Ham ho tro thong bao (internal)
async function notifyOwnerCommissionSettled(restaurantId, amount) {
  try {
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
    const restBase = getRestaurantServiceBaseUrl();
    const restData = await requestJson('GET', `${restBase}/restaurants/${restaurantId}`, undefined).catch(() => null);
    const ownerId = restData?.data?.ownerId || restData?.ownerId;
    
    if (ownerId) {
      // 1. Notify Owner
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          payload: {
            userId: ownerId,
            title: 'Commission Settled',
            message: `System has collected commission fee of ${amount.toLocaleString()} VND.`,
            link: '/restaurant/wallet',
            type: 'COMMISSION_SETTLED'
          }
        })
      });

      // 2. Notify ADMIN
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          payload: {
            role: 'ADMIN',
            title: 'Commission Collected',
            message: `[Admin] has collected commission fee of ${amount.toLocaleString()} VND from restaurant (ID: ${restaurantId}).`,
            link: '/audit-requests',
            type: 'COMMISSION_SETTLED'
          }
        })
      });
    }
  } catch (err) {
    // Ignore error
  }
}

// Quy trinh doi soat commission theo quy (Refactor de su dung collectCommissions)
async function settleQuarterCommission({ year, quarter, adminUserId, restaurantIds, dryRun, minAgeMinutes }) {
  const { start, end } = quarterRange(year, quarter);
  const contextKey = `q${quarter}:${year}`;
  
  return await collectCommissions({
    from: start,
    to: end,
    adminUserId,
    restaurantIds,
    dryRun,
    minAgeMinutes,
    description: `Quarterly commission settlement Q${quarter}/${year}`,
    contextKey
  });
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

// ====== PARTNER REQUESTS ======
async function getPartnerRequests(query = {}, authorization) {
  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};

  if (authorization) {
    headers['Authorization'] = authorization;
  }

  const result = await requestJson(
    'GET',
    `${authBaseUrl}/internal/partner-requests?page=${query.page || 1}&limit=${query.limit || 20}`,
    undefined,
    headers
  );

  return result?.data ?? result;
}

async function approvePartnerRequest(requestId, payload, authorization) {
  if (!requestId) throw createHttpError('requestId is required', 422);
  if (!payload || typeof payload !== 'object') throw createHttpError('payload is required', 422);

  // 1. Create the owner account (this auto-generates password and sends email)
  const ownerResult = await createRestaurantOwner({ payload, authorization });

  // 2. Clear the request from cache
  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};
  if (authorization) headers['Authorization'] = authorization;

  await requestJson(
    'DELETE',
    `${authBaseUrl}/internal/partner-requests/${requestId}`,
    undefined,
    headers
  );

  return ownerResult;
}

async function rejectPartnerRequest(requestId, authorization) {
  if (!requestId) throw createHttpError('requestId is required', 422);

  const authBaseUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:3001/api/v1/auth').replace(/\/+$/, '');
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const headers = internalToken ? { 'x-internal-token': internalToken } : {};
  if (authorization) headers['Authorization'] = authorization;

  // 1. Fetch the request details before deleting (to get email and name)
  let requestDetails = null;
  try {
    const fetchResult = await requestJson(
      'GET',
      `${authBaseUrl}/internal/partner-requests/${requestId}`,
      undefined,
      headers
    );
    requestDetails = fetchResult?.data || fetchResult;
  } catch (err) {
    console.warn(`Failed to fetch partner request ${requestId} before rejection:`, err.message);
  }

  // 2. Delete the request
  const result = await requestJson(
    'DELETE',
    `${authBaseUrl}/internal/partner-requests/${requestId}`,
    undefined,
    headers
  );

  // 3. Send Rejection Email Notification
  if (requestDetails && requestDetails.email) {
    try {
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          payload: {
            to: requestDetails.email,
            templateType: 'partner_request_rejected',
            data: {
              name: requestDetails.name || 'Partner'
            }
          }
        })
      });
    } catch (err) {
      console.warn('Failed to send rejection email notification:', err.message);
    }
  }

  return result?.data ?? result;
}

async function rejectRestaurant(restaurantId) {
  if (!restaurantId) throw createHttpError('restaurantId is required', 422);

  // 1. Fetch restaurant and owner details before deleting
  const restaurant = await adminModel.getRestaurantById(restaurantId);
  if (!restaurant) throw createHttpError('Restaurant not found', 404);
  
  // Chi cho phep reject nha hang dang o trang thai pending
  if (String(restaurant.status).toLowerCase() !== 'pending') {
    throw createHttpError('Only pending restaurants can be rejected/deleted. Active restaurants should be suspended instead.', 400);
  }

  const owner = await adminModel.getUserAuthById(restaurant.ownerId);

  // 2. Perform Hard Delete from SQL
  await adminModel.hardDeleteRestaurant(restaurantId);

  // 3. Send Rejection Email Notification
  if (owner && owner.email) {
    try {
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008/api/v1/notifications';
      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          payload: {
            to: owner.email,
            templateType: 'restaurant_rejected',
            data: {
              ownerName: owner.fullName || owner.name || 'Owner',
              restaurantName: restaurant.name
            }
          }
        })
      });
    } catch (err) {
      console.warn('Failed to send restaurant rejection email notification:', err.message);
    }
  }

  return { success: true, restaurantId };
}

/**
 * Lấy danh sách yêu cầu rút tiền cho Admin.
 * Parse sẵn metadataJson để FE có đủ thông tin ngân hàng.
 */
async function getWithdrawals(query = {}) {
  const result = await adminModel.getWithdrawals(query);
  
  // Parse metadataJson cho tung giao dich
  if (result.data && result.data.length > 0) {
    result.data = result.data.map(tx => {
      let bankDetails = null;
      if (tx.metadataJson) {
        try {
          const meta = JSON.parse(tx.metadataJson);
          bankDetails = meta.bankInfo || { method: meta.withdrawMethod };
        } catch (e) {
          console.warn(`Failed to parse metadata for tx ${tx.id}`);
        }
      }
      
      return {
        ...tx,
        bankDetails,
        // Canh bao neu so tien rut lon hon so du hien tai (goi y rui ro cho Admin)
        riskSignals: {
          insufficientBalance: Number(tx.amount) > Number(tx.currentWalletBalance),
          unusualAmount: Number(tx.amount) > 50000000 // Vi du: Tren 50 trieu la bat thuong
        }
      };
    });
  }
  
  return result;
}

module.exports = {
  createRestaurant,
  updateRestaurant,
  getStats,
  getPendingRestaurants,
  approveRestaurant,
  activateRestaurant,
  suspendRestaurant,
  rejectRestaurant,
  getBookings,
  getTransactions,
  settleQuarterCommission,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawals,
  createRestaurantOwner,
  getAdminRevenueStats,
  resetOwnerPassword,
  getPartnerRequests,
  approvePartnerRequest,
  rejectPartnerRequest,
  getRestaurants,
  collectCommissions,
  getUsers,
  updateUser,
  deleteUser
};

