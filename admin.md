Mục tiêu của admin-service trong dự án bạn lúc này nên là:

quản trị restaurant

quản trị user

xem bookings

xem transactions / wallet

dashboard thống kê tổng quan

thao tác suspend / approve nhà hàng

về sau mới mở rộng sang report sâu hơn

1. Vai trò của admin-service

Bạn đã có:

auth-service

user-service

restaurant-service

booking-service

payment-service

Vậy admin-service không nên tạo dữ liệu nghiệp vụ lõi riêng, mà nên là service:

đọc tổng hợp

ra quyết định quản trị

gọi/update dữ liệu ở các bảng lõi

Nói ngắn gọn:

restaurant-service lo nghiệp vụ nhà hàng

booking-service lo booking

payment-service lo payment/wallet

admin-service lo moderation + stats + approval + audit

2. Scope nên làm trước

Tôi khuyên phase 1 của admin-service chỉ làm 7 API này:

GET    /api/v1/admin/dashboard/stats
GET    /api/v1/admin/restaurants/pending
PUT    /api/v1/admin/restaurants/:id/approve
PUT    /api/v1/admin/restaurants/:id/suspend
GET    /api/v1/admin/users
GET    /api/v1/admin/bookings
GET    /api/v1/admin/transactions

Đây là bộ vừa đủ để có “admin panel backend”.

3. Dữ liệu admin-service sẽ đọc từ đâu

Với hệ thống hiện tại của bạn, nhanh và hợp lý nhất là:

Admin-service đọc trực tiếp SQL Server

Tức là nó query trực tiếp các bảng:

Users

Restaurants

Bookings

Transactions

Wallets

Ưu điểm:

nhanh làm

ít phụ thuộc service-to-service

hợp với state hiện tại của project

Sau này nếu muốn sạch hơn, bạn mới tách ra gọi nội bộ giữa services.

4. File structure nên dùng

Theo doc bạn đã sửa, admin-service nên đi theo dạng tối giản này:

services/admin-service/
└── src/
    ├── config/
    │   └── sql.js
    ├── controllers/
    │   └── admin.controller.js
    ├── services/
    │   └── admin.service.js
    ├── models/
    │   └── admin.sql.js
    ├── routes/
    │   └── admin.route.js
    ├── middlewares/
    │   ├── jwt.middleware.js
    │   ├── requireRole.middleware.js
    │   └── error.middleware.js
    ├── validators/
    │   └── admin.validator.js
    ├── app.js
    └── index.js

Tôi thêm models/admin.sql.js vì bạn đang làm theo style SQL model ở các service khác, rất hợp.

5. Env cho admin-service

Tạo .env kiểu này:

PORT=3006

DB_USER=
DB_PASSWORD=
DB_SERVER=(localdb)\MSSQLLocalDB
DB_PORT=1433
DB_NAME=SeatNow
DB_PIPE_NAME=np:\\.\pipe\LOCALDB#050D5C32\tsql\query
DB_ENCRYPT=true
DB_TRUST_CERT=true

JWT_ACCESS_SECRET=vhTony_24_access
6. Middleware phân quyền

Admin-service chỉ cho ADMIN dùng.

middlewares/jwt.middleware.js

Bạn tái dùng logic decode token như các service khác.

middlewares/requireRole.middleware.js
module.exports = function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    next();
  };
};

Tất cả route admin sẽ dùng:

jwt.requireAuth, requireRole('ADMIN')
7. Các bảng admin sẽ làm việc
Users

Dùng để:

liệt kê user

lọc theo role

khóa/mở khóa nếu sau này cần

Các cột hay dùng:

id

fullName

email

phone

role

isDeleted

createdAt

Restaurants

Dùng để:

xem restaurant pending

approve

suspend

xem owner

Các cột hay dùng:

id

ownerId

name

status

isVerified

createdAt

updatedAt

Bookings

Dùng để:

xem danh sách booking toàn hệ thống

lọc status

lọc theo restaurant

lọc theo thời gian

Transactions

Dùng để:

xem top-up

xem deposit

xem commission

audit payment

Wallets

Dùng để:

xem số dư ví restaurant/admin

thống kê tổng tiền trong hệ thống

8. API chi tiết và cách làm
API 1 — Dashboard stats
GET /api/v1/admin/dashboard/stats
Trả về gì
{
  "success": true,
  "data": {
    "totalUsers": 120,
    "totalCustomers": 95,
    "totalOwners": 24,
    "totalRestaurants": 18,
    "pendingRestaurants": 3,
    "activeRestaurants": 12,
    "suspendedRestaurants": 3,
    "totalBookings": 560,
    "pendingBookings": 41,
    "confirmedBookings": 210,
    "completedBookings": 250,
    "cancelledBookings": 59,
    "totalTransactions": 430,
    "totalDepositTransactions": 180,
    "totalTopupTransactions": 42,
    "totalWalletBalance": 12500000
  }
}
Query cần viết

count users theo role

count restaurants theo status

count bookings theo status

count transactions theo type

sum wallet balance

API 2 — Pending restaurants
GET /api/v1/admin/restaurants/pending
Trả về gì

Danh sách nhà hàng đang chờ duyệt.

Điều kiện lọc

Ví dụ:

status = 'pending'
hoặc

isVerified = 0

Tùy schema restaurant của bạn đang dùng field nào làm nguồn sự thật.

API 3 — Approve restaurant
PUT /api/v1/admin/restaurants/:id/approve
Logic

check restaurant tồn tại

update:

status = 'active'

isVerified = 1

updatedAt = now

Lưu ý

Nếu restaurant chưa có wallet, bạn nên tạo wallet restaurant ngay lúc approve.

Đây là một quyết định rất tốt về nghiệp vụ.

Pseudo:

approve restaurant

kiểm tra Wallets đã có restaurantId chưa

nếu chưa có thì create wallet

API 4 — Suspend restaurant
PUT /api/v1/admin/restaurants/:id/suspend
Logic

update status = 'suspended'

updatedAt = now

Nếu muốn cứng hơn, bạn có thể:

khóa wallet restaurant (Wallets.status = 'locked')

Tôi khuyên nên có tùy chọn này sau.

API 5 — Get users
GET /api/v1/admin/users
Hỗ trợ query params

role

keyword

page

limit

Ví dụ:

GET /api/v1/admin/users?role=RESTAURANT_OWNER&keyword=test&page=1&limit=20
API 6 — Get bookings
GET /api/v1/admin/bookings
Hỗ trợ filter

status

restaurantId

dateFrom

dateTo

page

limit

Đây sẽ là API rất hữu ích cho admin dashboard.

API 7 — Get transactions
GET /api/v1/admin/transactions
Filter nên có

type

status

provider

restaurantId

walletId

page

limit

Nếu restaurantId truyền vào:

join Wallets để lấy transaction của ví restaurant đó

hoặc join Bookings nếu transaction là deposit

9. Model SQL nên viết gì

Tạo file: src/models/admin.sql.js

Các hàm nên có:

getDashboardStats()

getPendingRestaurants()

approveRestaurant(id)

suspendRestaurant(id)

ensureRestaurantWallet(restaurantId)

getUsers(filters)

getBookings(filters)

getTransactions(filters)

10. Gợi ý code model
config/sql.js
const sql = require('mssql');
require('dotenv').config();

let pool;

async function getPool() {
  if (pool) return pool;

  pool = await sql.connect({
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() === 'true'
    }
  });

  return pool;
}

module.exports = { sql, getPool };
models/admin.sql.js
getPendingRestaurants
const { sql, getPool } = require('../config/sql');

async function getPendingRestaurants() {
  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT
      r.id,
      r.name,
      r.ownerId,
      r.status,
      r.isVerified,
      r.createdAt,
      u.fullName AS ownerName,
      u.email AS ownerEmail,
      u.phone AS ownerPhone
    FROM dbo.Restaurants r
    LEFT JOIN dbo.Users u ON r.ownerId = u.id
    WHERE r.status = 'pending' OR r.isVerified = 0
    ORDER BY r.createdAt DESC
  `);

  return rs.recordset;
}
approveRestaurant
async function approveRestaurant(restaurantId) {
  const pool = await getPool();
  await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      UPDATE dbo.Restaurants
      SET status = 'active',
          isVerified = 1,
          updatedAt = SYSUTCDATETIME()
      WHERE id = @restaurantId
    `);
}
ensureRestaurantWallet
async function ensureRestaurantWallet(restaurantId, ownerId) {
  const pool = await getPool();

  const existed = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT TOP 1 id
      FROM dbo.Wallets
      WHERE restaurantId = @restaurantId
    `);

  if (existed.recordset[0]) return existed.recordset[0];

  const created = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('userId', sql.UniqueIdentifier, ownerId)
    .query(`
      INSERT INTO dbo.Wallets (
        id, userId, restaurantId, balance, lockedAmount,
        createdAt, updatedAt, currency, status
      )
      OUTPUT INSERTED.*
      VALUES (
        NEWID(), @userId, @restaurantId, 0, 0,
        SYSUTCDATETIME(), SYSUTCDATETIME(), 'VND', 'active'
      )
    `);

  return created.recordset[0];
}
11. Service layer nên làm gì

src/services/admin.service.js sẽ:

gọi model

gói business logic

ví dụ approve restaurant thì:

approve

đảm bảo có wallet

Ví dụ:

const adminModel = require('../models/admin.sql');

async function approveRestaurant(restaurantId) {
  const restaurant = await adminModel.getRestaurantById(restaurantId);
  if (!restaurant) throw new Error('Restaurant not found');

  await adminModel.approveRestaurant(restaurantId);
  await adminModel.ensureRestaurantWallet(restaurantId, restaurant.ownerId);

  return { success: true };
}
12. Controller layer

src/controllers/admin.controller.js nên chỉ:

nhận request

gọi service

trả JSON

Ví dụ:

const adminService = require('../services/admin.service');

async function getPendingRestaurants(req, res, next) {
  try {
    const data = await adminService.getPendingRestaurants();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
13. Route layer

src/routes/admin.route.js

const express = require('express');
const c = require('../controllers/admin.controller');
const jwt = require('../middlewares/jwt.middleware');
const requireRole = require('../middlewares/requireRole.middleware');

const r = express.Router();

r.use(jwt.requireAuth, requireRole('ADMIN'));

r.get('/dashboard/stats', c.getDashboardStats);
r.get('/restaurants/pending', c.getPendingRestaurants);
r.put('/restaurants/:id/approve', c.approveRestaurant);
r.put('/restaurants/:id/suspend', c.suspendRestaurant);
r.get('/users', c.getUsers);
r.get('/bookings', c.getBookings);
r.get('/transactions', c.getTransactions);

module.exports = r;
14. App và index
app.js

mount /api/v1/admin

add json parser

add error middleware

index.js

connect SQL

listen 3006

15. Luồng phối hợp với payment-service

Điểm nối quan trọng nhất giữa admin-service và payment-service là:

A. approve restaurant

Admin approve xong → tạo wallet restaurant

B. transaction monitoring

Admin xem Transactions để audit:

deposit

topup

commission

C. charge commission

API này hiện tại đang ở payment-service
Tôi khuyên giữ ở payment-service, không chuyển sang admin-service.

Admin-service chỉ là nơi admin panel gọi tới payment-service hoặc hiển thị link/action.

16. Trình tự triển khai thực tế

Làm đúng thứ tự này:

Phase 1

dựng admin-service

config SQL

auth middleware

route admin cơ bản

Phase 2

GET /dashboard/stats

GET /restaurants/pending

PUT /restaurants/:id/approve

PUT /restaurants/:id/suspend

Phase 3

GET /users

GET /bookings

GET /transactions

Phase 4

filter / paging / search

report sâu hơn nếu cần

17. Những chỗ cần lưu ý
1. Không để admin-service xử lý payment logic nặng

Không cộng/trừ ví trực tiếp ở admin-service nếu bạn đã có payment-service.
Admin-service chỉ:

xem

duyệt

kích hoạt

gọi action

2. Wallet restaurant nên tạo lúc approve

Đây là thời điểm hợp lý nhất.

3. Dashboard stats chỉ cần SQL aggregate

Chưa cần Mongo hay analytics riêng ở phase này.

18. Kết luận

Cách triển khai admin-service tốt nhất cho bạn lúc này là:

làm service quản trị đọc/tổng hợp

query trực tiếp SQL Server

tập trung vào:

approve/suspend restaurant

list users/bookings/transactions

dashboard stats

khi approve restaurant thì tạo wallet restaurant luôn

payment/wallet logic vẫn giữ ở payment-service

Bước tiếp theo hợp lý nhất là tôi viết cho bạn bộ code khởi tạo hoàn chỉnh của admin-service gồm:

config/sql.js

models/admin.sql.js

services/admin.service.js

controllers/admin.controller.js

routes/admin.route.js

app.js

index.js

tôi đã có một số route để xử lí cho phần comission fee cho admin: Admin gọi POST /admin/commissions/settle-quarter. Admin-service hỏi booking-service lấy danh sách booking eligible theo restaurant/kỳ. Admin-service gọi payment-service POST /wallet/commission/charge (theo từng booking hoặc gộp từng restaurant). Charge thành công mới callback booking-service để mark commissionPaid=1. Có idempotency key theo quý + restaurant để chống chạy lặp.  đây là các file có sãnx, hãy hướng dẫn tôi code từ đầu nhé:
const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin_controller');

router.get('/stats', controller.getStats);
router.post('/commissions/settle-quarter', controller.settleQuarterCommission);

module.exports = router;

/**
 * admin.controller.js - HTTP handlers (placeholder)
 */
const adminService = require('../services/admin_service');

async function getStats(req, res) {
  const stats = await adminService.getStats();
  res.json(stats);
}

async function settleQuarterCommission(req, res) {
  try {
    const data = await adminService.settleQuarterCommission({
      year: req.body?.year,
      quarter: req.body?.quarter,
      adminUserId: req.body?.adminUserId,
      restaurantIds: req.body?.restaurantIds,
      dryRun: req.body?.dryRun,
      minAgeMinutes: req.body?.minAgeMinutes
    });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(e.status || 400).json({ success: false, message: e.message });
  }
}

module.exports = {
  getStats,
  settleQuarterCommission
};

/**
 * admin.service.js - business logic for admin (placeholder)
 */
async function getStats() {
  // Aggregate basic stats (placeholder)
  return { users: 0, restaurants: 0, bookings: 0 };
}

function quarterRange(year, quarter) {
  const q = Number(quarter);
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 3000) throw new Error('Invalid year');
  if (![1, 2, 3, 4].includes(q)) throw new Error('Invalid quarter');

  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(y, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, startMonth + 3, 1, 0, 0, 0, 0));
  return { start, end };
}

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
    const msg = json?.message || HTTP ${res.status} calling ${url};
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

// Admin orchestrator: charge commission that theo quy.
async function settleQuarterCommission({ year, quarter, adminUserId, restaurantIds, dryRun, minAgeMinutes }) {
  if (!adminUserId) throw new Error('adminUserId is required');

  const { start, end } = quarterRange(year, quarter);
  const bookingBase = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004/api/v1';
  const paymentBase = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005/api/v1/payment';
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

  const headers = internalToken ? { 'x-internal-token': internalToken } : {};
  const preview = await postJson(
    ${bookingBase}/internal/commissions/candidates,
    {
      from: start.toISOString(),
      to: end.toISOString(),
      minAgeMinutes: Number(minAgeMinutes || 0),
      restaurantIds: Array.isArray(restaurantIds) ? restaurantIds : []
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

  for (const [restaurantId, rows] of group.entries()) {
    const amount = rows.reduce((sum, x) => sum + Number(x.commissionFee || 0), 0);
    const bookingIds = rows.map((x) => x.id);

    if (dryRun) {
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        status: 'preview'
      });
      continue;
    }

    try {
      await postJson(${paymentBase}/wallet/commission/charge, {
        restaurantId,
        adminUserId,
        amount,
        description: Quarterly commission settlement Q${quarter}/${year}
      });

      const marked = await postJson(
        ${bookingBase}/internal/commissions/mark-paid,
        { bookingIds },
        headers
      );

      const markedCount = Number(marked?.data?.affectedCount || 0);
      totalCharged += amount;
      totalMarked += markedCount;
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
        markedCount,
        status: 'settled'
      });
    } catch (e) {
      restaurants.push({
        restaurantId,
        bookingCount: rows.length,
        amount,
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
    dryRun: !!dryRun,
    candidateBookings: items.length,
    candidateRestaurants: group.size,
    totalCharged,
    totalMarked,
    restaurants
  };
}

module.exports = {
  getStats,
  settleQuarterCommission
};

Tôi sẽ bám đúng các file bạn đã có để biến flow “settle commission theo quý” từ placeholder thành chạy được thật. Trọng tâm là chốt 3 thứ: admin-service orchestration, booking-service internal endpoints, và payment-service idempotent charge để không charge lặp.

Đã suy nghĩ trong 24s

Được. Mình sẽ đi từ đầu đến cuối để bạn biến flow này thành chạy được thật, dựa trên đúng 3 file bạn đang có trong admin-service.

Flow bạn đã chốt là đúng hướng:

Admin gọi POST /admin/commissions/settle-quarter

admin-service hỏi booking-service lấy danh sách booking đủ điều kiện tính commission

admin-service gọi payment-service để charge commission từ ví nhà hàng sang ví admin

Chỉ khi charge thành công mới gọi lại booking-service để mark commissionPaid = 1

Có idempotency key theo year + quarter + restaurantId để chống chạy lặp

Giờ mình sẽ hướng dẫn triển khai theo đúng thứ tự dễ làm nhất.

1) Mục tiêu của phase này

Bạn sẽ hoàn thiện 3 phần:

A. admin-service

Làm orchestration theo quý:

lấy candidate bookings

group theo restaurant

tính tổng commission

gọi payment-service charge

gọi booking-service mark-paid

hỗ trợ dryRun

B. booking-service

Thêm 2 internal endpoint:

POST /internal/commissions/candidates

POST /internal/commissions/mark-paid

C. payment-service

Hoàn thiện:

POST /wallet/commission/charge

có idempotency key

internal transfer:

trừ ví restaurant

cộng ví admin

ghi 2 transaction đối ứng

2) Rule nghiệp vụ cần chốt thật rõ
Booking nào được coi là eligible để thu commission?

Tôi khuyên dùng rule này:

status = 'COMPLETED'

commissionFee > 0

commissionPaid = 0

completedAt >= from

completedAt < to

nếu có minAgeMinutes, thì booking phải đủ “già” để tránh vừa complete đã charge ngay

Charge theo cách nào?

Bạn đã nói có 2 lựa chọn:

theo từng booking

hoặc gộp theo restaurant

Tôi khuyên gộp theo restaurant trong 1 quý như code placeholder của bạn đang làm. Cách này:

ít transaction hơn

dễ đối soát hơn

rất hợp với quarterly settlement

Idempotency key

Nên dùng:

COMMISSION:Q{quarter}:{year}:{restaurantId}

Ví dụ:

COMMISSION:Q1:2026:1D106F0B-F292-405B-9E3A-76B219141863

Nếu payment-service thấy key này đã chạy thành công trước đó thì không charge lại.

3) Env cần có
Admin-service .env
PORT=3006

BOOKING_SERVICE_URL=http://localhost:3004/api/v1
PAYMENT_SERVICE_URL=http://localhost:3005/api/v1/payment

INTERNAL_SERVICE_TOKEN=your_internal_secret
Booking-service .env
INTERNAL_SERVICE_TOKEN=your_internal_secret
Payment-service .env
INTERNAL_SERVICE_TOKEN=your_internal_secret

Tất cả internal service phải dùng chung token này.

4) Admin-service: bạn đã có gì và cần sửa gì

Bạn đang có:

routes/admin_route.js

controllers/admin_controller.js

services/admin_service.js

Cấu trúc đó ổn. Ta chỉ cần:

giữ getStats

hoàn thiện settleQuarterCommission

thêm validate đầu vào

thêm idempotency khi gọi payment-service

5) Admin route

File route hiện tại của bạn dùng được:

const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin_controller');

router.get('/stats', controller.getStats);
router.post('/commissions/settle-quarter', controller.settleQuarterCommission);

module.exports = router;

Tôi khuyên thêm middleware admin auth sau này, nhưng để chạy trước thì giữ vậy được.

6) Admin controller

File của bạn cũng ổn. Chỉ nên thêm validate nhẹ và parse kiểu dữ liệu rõ hơn.

Bản nên dùng
const adminService = require('../services/admin_service');

async function getStats(req, res) {
  const stats = await adminService.getStats();
  res.json({ success: true, data: stats });
}

async function settleQuarterCommission(req, res) {
  try {
    const data = await adminService.settleQuarterCommission({
      year: req.body?.year,
      quarter: req.body?.quarter,
      adminUserId: req.body?.adminUserId,
      restaurantIds: req.body?.restaurantIds,
      dryRun: req.body?.dryRun,
      minAgeMinutes: req.body?.minAgeMinutes
    });

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(e.status || 400).json({
      success: false,
      message: e.message
    });
  }
}

module.exports = {
  getStats,
  settleQuarterCommission
};
7) Admin service: sửa để orchestration chuẩn hơn

File của bạn đã khá đúng. Tôi sẽ chỉnh thành version hoàn thiện hơn một chút:

validate input

tạo idempotency key theo restaurant + quý

gọi payment-service với idempotencyKey

nếu charge ok mới mark booking paid

admin_service.js
async function getStats() {
  return { users: 0, restaurants: 0, bookings: 0 };
}

function quarterRange(year, quarter) {
  const q = Number(quarter);
  const y = Number(year);

  if (!Number.isInteger(y) || y < 2000 || y > 3000) {
    throw new Error('Invalid year');
  }
  if (![1, 2, 3, 4].includes(q)) {
    throw new Error('Invalid quarter');
  }

  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(y, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, startMonth + 3, 1, 0, 0, 0, 0));
  return { start, end };
}

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

function buildQuarterCommissionKey({ year, quarter, restaurantId }) {
  return `COMMISSION:Q${quarter}:${year}:${restaurantId}`;
}

async function settleQuarterCommission({
  year,
  quarter,
  adminUserId,
  restaurantIds,
  dryRun,
  minAgeMinutes
}) {
  if (!adminUserId) throw new Error('adminUserId is required');

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
      restaurantIds: Array.isArray(restaurantIds) ? restaurantIds : []
    },
    headers
  );

  const items = preview?.data?.items || [];

  const grouped = new Map();
  for (const row of items) {
    const rid = String(row.restaurantId);
    if (!grouped.has(rid)) grouped.set(rid, []);
    grouped.get(rid).push(row);
  }

  const restaurants = [];
  let totalCharged = 0;
  let totalMarked = 0;

  for (const [restaurantId, rows] of grouped.entries()) {
    const amount = rows.reduce((sum, x) => sum + Number(x.commissionFee || 0), 0);
    const bookingIds = rows.map((x) => x.id);
    const idempotencyKey = buildQuarterCommissionKey({ year, quarter, restaurantId });

    if (dryRun) {
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
    dryRun: !!dryRun,
    candidateBookings: items.length,
    candidateRestaurants: grouped.size,
    totalCharged,
    totalMarked,
    restaurants
  };
}

module.exports = {
  getStats,
  settleQuarterCommission
};
8) Booking-service cần thêm 2 internal endpoint

Đây là phần bắt buộc.

Route cần thêm

Tạo file route internal hoặc gắn luôn vào booking route nội bộ:

r.post('/internal/commissions/candidates', internalAuth, c.getCommissionCandidates);
r.post('/internal/commissions/mark-paid', internalAuth, c.markCommissionPaid);

Bạn cần middleware internalAuth:

function internalAuth(req, res, next) {
  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized internal request' });
  }
  next();
}
Controller booking cần thêm
getCommissionCandidates

Trả danh sách booking đủ điều kiện:

status = 'COMPLETED'

commissionFee > 0

commissionPaid = 0

trong khoảng quý

lọc theo restaurantIds nếu có

markCommissionPaid

Chỉ update những booking trong danh sách bookingIds:

commissionPaid = 1

updatedAt = now

Nếu muốn đẹp hơn, thêm cột commissionSettlementKey sau này. Nhưng với schema hiện tại, chưa bắt buộc.

SQL logic cho candidates

Ví dụ query:

SELECT
  id,
  restaurantId,
  commissionFee,
  completedAt
FROM dbo.Bookings
WHERE status = 'COMPLETED'
  AND commissionPaid = 0
  AND commissionFee IS NOT NULL
  AND commissionFee > 0
  AND completedAt >= @from
  AND completedAt < @to

Nếu có minAgeMinutes:

AND completedAt <= DATEADD(MINUTE, -@minAgeMinutes, SYSUTCDATETIME())
SQL logic cho mark-paid
UPDATE dbo.Bookings
SET commissionPaid = 1,
    updatedAt = SYSUTCDATETIME()
WHERE id IN (...)
  AND commissionPaid = 0
9) Payment-service cần hoàn thiện route charge commission

Bạn đã làm phần ví rồi, nên giờ chỉ cần chốt endpoint này cho chắc.

Route
r.post('/wallet/commission/charge', internalAuth, c.chargeCommission);

Tôi khuyên route này chỉ cho internal/admin gọi, không public cho owner.

Controller
async function chargeCommission(req, res, next) {
  try {
    const { restaurantId, adminUserId, amount, description, idempotencyKey } = req.body;

    const result = await walletService.chargeCommission({
      restaurantId,
      adminUserId,
      amount,
      description,
      idempotencyKey
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
Wallet service: bắt buộc thêm idempotency

Bạn đang cần chống charge lặp theo quý + restaurant.

Trong wallet_service.js, hàm chargeCommission nên:

nhận idempotencyKey

kiểm tra đã có transaction nào với key này chưa

nếu có rồi thì trả kết quả idempotent

nếu chưa có thì thực hiện transfer

Logic check idempotency

Bạn có thể dùng:

Redis

hoặc DB bằng Transactions.idempotencyKey

Tôi khuyên DB là nguồn thật, Redis chỉ để lock ngắn hạn.

Model payment cần thêm hàm check idempotency
async function findTransactionByIdempotencyKey(idempotencyKey) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('idempotencyKey', sql.NVarChar(100), idempotencyKey)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Transactions
      WHERE idempotencyKey = @idempotencyKey
      ORDER BY createdAt DESC
    `);

  return rs.recordset[0] || null;
}
Charge commission nên ghi idempotencyKey lên transaction

Khi insert 2 transaction:

transaction restaurant debit: gắn idempotencyKey

transaction admin credit: cũng gắn idempotencyKey

Như vậy lần sau gọi lại cùng key sẽ detect được.

10) Flow hoàn chỉnh sau khi code xong
Case dryRun = true

admin gọi /admin/commissions/settle-quarter

admin-service lấy candidate bookings

group theo restaurant

chỉ trả preview:

nhà hàng nào

bao nhiêu booking

tổng bao nhiêu tiền

Case dryRun = false

admin gọi /admin/commissions/settle-quarter

admin-service lấy candidate bookings

group theo restaurant

với mỗi restaurant:

tạo idempotencyKey = COMMISSION:Qx:year:restaurantId

gọi payment-service charge

nếu success → gọi booking-service mark-paid

nếu fail → không mark-paid

trả kết quả cuối

11) Những edge case cần xử lý
A. Restaurant không đủ số dư ví

Payment-service phải trả lỗi:

Insufficient wallet balance

Admin-service sẽ ghi:

restaurant đó status = failed

B. Gọi lặp cùng quý

Payment-service detect idempotencyKey và không charge lại.

C. Charge thành công nhưng mark-paid lỗi

Đây là case khó.

Bạn có 2 cách:

Cách đơn giản hiện tại

trả status = failed

admin thấy lỗi và xử lý lại manually

Cách tốt hơn sau này

có bảng CommissionSettlements

lưu trạng thái orchestration

Hiện tại, để nhanh, dùng cách đơn giản trước.

12) Gợi ý nên thêm bảng settlement hay chưa?

Cho phase hiện tại: chưa bắt buộc.

Bạn có thể chạy orchestration bằng:

candidate query từ booking-service

idempotencyKey từ admin-service

charge ở payment-service

mark-paid ở booking-service

Là đủ để chạy.

Sau này nếu muốn audit đẹp hơn, thêm:

CommissionSettlements

CommissionSettlementItems

13) Checklist triển khai
Admin-service

 validate input quarter/year

 gọi booking internal candidates

 group by restaurant

 gọi payment charge với idempotencyKey

 gọi booking mark-paid nếu success

 hỗ trợ dryRun

Booking-service

 internal auth

 POST /internal/commissions/candidates

 POST /internal/commissions/mark-paid

Payment-service

 internal auth

 POST /wallet/commission/charge

 check idempotencyKey

 internal transfer restaurant -> admin

 ghi 2 transactions

 gắn idempotencyKey

14) Kết luận

Bạn đã có skeleton rất tốt rồi. Từ đây, cách làm đúng là:

hoàn thiện admin-service orchestration

thêm internal endpoints ở booking-service

thêm idempotent charge ở payment-service

chỉ mark commissionPaid = 1 sau khi charge thành công

Nếu bạn muốn, bước tiếp theo tôi sẽ viết cho bạn bộ code hoàn chỉnh copy-paste được cho cả 3 phần:

admin-service/admin_service.js hoàn chỉnh

booking-service internal controller + route

payment-service charge commission có idempotencyKey đầy đủ