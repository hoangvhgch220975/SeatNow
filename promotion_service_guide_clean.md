 Promotion Service — Guide (SeatNow)


---

## 1) Mục tiêu & phạm vi

**Promotion Service** là microservice quản lý **khuyến mại / mã giảm giá** cho hệ thống SeatNow, hỗ trợ:
- Quản lý promotions theo **nhà hàng** (tạo/sửa/xoá/bật-tắt)
- Khách hàng tra cứu, validate, apply promotion khi đặt bàn
- Ghi nhận lịch sử sử dụng (usage), phục vụ thống kê

> Tài liệu tập trung vào: **chạy local**, **cấu hình**, **business rules**, **database**, và **tích hợp với các service khác**.

---

## 2) Quick start (Local / Docker)

### 2.1 Local (Node.js)
```bash
cd promotion-service
npm install

# Tạo file env
cp .env.example .env
# sửa .env theo môi trường của bạn

npm run dev
```

### 2.2 Database schema (SQL Server)
Chạy `database/schema.sql` trên SQL Server (LocalDB / Docker SQL Server tuỳ setup).

Ví dụ dùng `sqlcmd`:
```bash
sqlcmd -S localhost -U sa -P YourPassword
CREATE DATABASE seatnow;
GO
USE seatnow;
GO
:r database/schema.sql
GO
```

### 2.3 Docker (SQL Server + Redis + Promotion Service)
```bash
docker-compose up -d
docker-compose logs -f promotion-service
docker-compose down
```

### 2.4 Health check
```bash
GET http://localhost:3005/health
```

---

## 3) Cấu hình (.env)

Ví dụ (điền theo môi trường của bạn):
```env
# Server
PORT=3005
NODE_ENV=development

# SQL Server
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=seatnow
DB_USER=sa
DB_PASSWORD=YourStrong@Password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (tuỳ kiến trúc auth của bạn)
JWT_SECRET=your-secret-key
```

---

## 4) Tổng quan chức năng

### 4.1 Nhóm API theo vai trò

**Restaurant Owner**
- CRUD promotion theo restaurant
- Bật/tắt active
- Xem thống kê & lịch sử usage

**Customer**
- Xem promotions khả dụng theo restaurant
- Lấy promotion theo code
- Validate trước khi đặt bàn
- Apply promotion cho booking
- Xem lịch sử usage của bản thân

**System / Ops**
- Health checks

> Các đường dẫn endpoint cụ thể tuỳ cấu trúc router của bạn (direct service hoặc đi qua gateway). Phần “Integration” bên dưới minh hoạ theo các route đã dùng trong bản gốc.

### 4.2 Promotion types (gợi ý)
```js
PERCENTAGE     // Giảm theo % (có maxDiscount)
FIXED_AMOUNT   // Giảm số tiền cố định
PER_PERSON     // Giảm theo số người
FREE_ITEM      // Tặng món (tuỳ chỉnh)
```

---

## 5) Business rules & tính an toàn

### 5.1 Validate promotion (các kiểm tra chính)
- Promotion **đang active**
- **Trong thời gian hiệu lực** (startDate–endDate)
- Đạt **min booking amount** (nếu có)
- Đạt **min guests** (nếu có)
- Phù hợp **ngày trong tuần** (applicableDays)
- Phù hợp **khung giờ** (applicableTimeSlots)
- Không vượt **usageLimit** (tổng)
- Không vượt **perUserLimit** (theo user)

### 5.2 Transaction & concurrency
Để tránh race-condition khi nhiều request apply cùng lúc:
- Apply promotion nên chạy trong **SQL transaction**
- Dùng khoá mức dòng khi update usageCount (ví dụ `UPDLOCK`, `ROWLOCK`)
- Isolation level thường dùng: `READ_COMMITTED`
- Nếu apply fail thì **rollback** booking hoặc rollback phần apply (tuỳ flow)

---

## 6) Database (SQL Server)

### 6.1 Tables (tối thiểu)
```sql
Promotions
  - id, restaurantId, name, code, type, value
  - maxDiscount, minBookingAmount, minGuests
  - applicableDays, applicableTimeSlots
  - usageLimit, usageCount, perUserLimit
  - startDate, endDate, isActive, status

PromotionUsages
  - id, promotionId, customerId, bookingId
  - discountAmount, usedAt
```

### 6.2 Indexes (gợi ý)
- (restaurantId, isActive, status) cho filter nhanh
- `code` unique
- (startDate, endDate) cho query theo thời gian
- (promotionId, customerId) cho check per-user limit
- `bookingId` unique (một booking chỉ apply 1 lần)

### 6.3 Triggers / jobs (tuỳ chọn)
- Auto-update timestamp
- Auto-expire promotions theo thời gian

---

## 7) Integration Guide (tích hợp các service)

> Mục tiêu chung: **Booking service** là nơi “chốt tiền”, Promotion service đóng vai trò **validate/apply** và ghi nhận usage.

### 7.1 Booking Service — validate & apply khi tạo booking

**Luồng đề xuất**
1) Client gửi booking + promotionCode  
2) Booking service gọi **validate** (để tính discount)  
3) Booking service tạo booking (lưu original/discount/final) trong transaction  
4) Nếu có discount, booking service gọi **apply** để ghi usage  
5) Nếu apply fail → rollback booking (hoặc đánh dấu booking lỗi tuỳ thiết kế)

Ví dụ code (rút gọn theo bản gốc):
```js
const axios = require('axios');

async function createBookingWithPromotion(bookingData, promotionCode, token) {
  const { restaurantId, totalAmount, numGuests, bookingDate, bookingTime } = bookingData;

  let discount = 0;
  let finalAmount = totalAmount;

  // 1) validate
  if (promotionCode) {
    const r = await axios.post(
      `${process.env.PROMOTION_SERVICE_URL}/api/promotions/validate`,
      { code: promotionCode, restaurantId, totalAmount, numGuests, bookingDate, bookingTime },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (r.data?.success) {
      discount = r.data.data.discount;
      finalAmount = totalAmount - discount;
    }
  }

  // 2) create booking (transaction ở booking service)
  // ... insert booking: originalAmount, discountAmount, finalAmount, appliedPromotionCode ...

  // 3) apply (ghi usage)
  if (promotionCode && discount > 0) {
    await axios.post(
      `${process.env.PROMOTION_SERVICE_URL}/api/promotions/apply`,
      { promotionCode, bookingId: "NEW_BOOKING_ID", bookingData },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  return { discount, finalAmount };
}
```

**Gợi ý cập nhật schema Bookings** (để lưu promotion info):
```sql
ALTER TABLE dbo.Bookings ADD
  originalAmount FLOAT NULL,
  discountAmount FLOAT NULL DEFAULT 0,
  finalAmount FLOAT NULL,
  appliedPromotionCode NVARCHAR(50) NULL;
```

---

### 7.2 Restaurant Service — hiển thị promotions trong restaurant details

Ví dụ:
```js
const axios = require('axios');

async function getRestaurantDetails(restaurantId) {
  const restaurant = await getRestaurant(restaurantId);

  let promotions = [];
  try {
    const r = await axios.get(
      `${process.env.PROMOTION_SERVICE_URL}/api/promotions/available`,
      { params: { restaurantId } }
    );
    if (r.data?.success) promotions = r.data.data;
  } catch (e) {
    // Không fail cả request nếu promotions lỗi
    console.error('Failed to fetch promotions:', e.message);
  }

  return { ...restaurant, activePromotions: promotions };
}
```

---

### 7.3 User Service — hiển thị lịch sử usage trong profile

Ví dụ:
```js
const axios = require('axios');

async function getUserProfile(userId, token) {
  const user = await getUser(userId);
  const bookings = await getUserBookings(userId);

  let promotionUsages = [];
  try {
    const r = await axios.get(
      `${process.env.PROMOTION_SERVICE_URL}/api/users/me/promotions/usages`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: 1, limit: 10 }
      }
    );
    if (r.data?.success) promotionUsages = r.data.data;
  } catch (e) {
    console.error('Failed to fetch promotion usages:', e.message);
  }

  return {
    ...user,
    bookings,
    promotionUsages,
    totalSavings: promotionUsages.reduce((sum, u) => sum + u.discountAmount, 0)
  };
}
```

---

### 7.4 Payment Service — tính amount sau khi áp dụng promotion

Gợi ý: Payment service nên ưu tiên dùng số liệu **đã lưu trong booking** (finalAmount/discountAmount).  
Nếu cần verify lại, có thể gọi validate để so sánh, nhưng đừng để payment fail vì promotion service timeout.

Ví dụ (rút gọn):
```js
const axios = require('axios');

async function createPayment(bookingId) {
  const booking = await getBooking(bookingId);

  let paymentAmount = booking.depositAmount || booking.totalAmount;

  if (booking.appliedPromotionCode) {
    try {
      const r = await axios.get(`${process.env.PROMOTION_SERVICE_URL}/api/promotions/validate`, {
        params: {
          code: booking.appliedPromotionCode,
          restaurantId: booking.restaurantId,
          totalAmount: booking.originalAmount,
          numGuests: booking.numGuests,
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime
        }
      });

      if (r.data?.success) {
        const verifiedDiscount = r.data.data.discount;
        paymentAmount = booking.originalAmount - verifiedDiscount;
      }
    } catch (e) {
      // fallback
      paymentAmount = booking.finalAmount || booking.totalAmount;
    }
  }

  return processPayment({ bookingId, amount: paymentAmount });
}
```

---

### 7.5 API Gateway — proxy routes + rate limiting

Ví dụ proxy:
```js
const { createProxyMiddleware } = require('http-proxy-middleware');

const PROMOTION_SERVICE_URL = process.env.PROMOTION_SERVICE_URL || 'http://promotion-service:3005';

router.use('/promotions', createProxyMiddleware({
  target: PROMOTION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/promotions': '/api/promotions' },
  onProxyReq: (proxyReq, req) => {
    if (req.headers.authorization) proxyReq.setHeader('Authorization', req.headers.authorization);
  }
}));
```

Rate limit “nhạy cảm” (validate/apply) nên chặt hơn:
- Ví dụ: 10 req / minute / IP (tuỳ policy)

---

### 7.6 Event-driven (tuỳ chọn)

**Publish** khi promotion được apply thành công:
- event: `promotion.applied`

**Subscribe** để hoàn tác usage nếu booking bị huỷ:
- event: `booking.cancelled` → xoá usage + decrement usageCount

---

## 8) Environment variables cho các service khác

Tất cả service cần gọi Promotion Service nên có:
```env
PROMOTION_SERVICE_URL=http://promotion-service:3005
```

---

## 9) Service-to-service authentication (tuỳ kiến trúc)

Nếu bạn có internal calls giữa services, có thể dùng JWT “service token”:
```js
const jwt = require('jsonwebtoken');

function generateServiceToken() {
  return jwt.sign(
    { service: process.env.SERVICE_NAME, role: 'service' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}
```

---

## 10) Monitoring & logging

Gợi ý thêm **correlation-id** để trace cross-service:
```js
const correlationId = require('uuid').v4();

axios.post(url, data, {
  headers: { 'X-Correlation-ID': correlationId }
});

// log kèm correlationId
logger.info('Applying promotion', { correlationId, promotionCode, bookingId });
```

---

## 11) Deployment checklist

- [ ] Đồng bộ `PROMOTION_SERVICE_URL` giữa các môi trường
- [ ] Setup auth nội bộ (nếu cần)
- [ ] Setup gateway routes + rate limit
- [ ] Setup event bus (nếu dùng event-driven)
- [ ] Monitoring cho cross-service calls
- [ ] Test integration (happy path + concurrency + cancellation)
- [ ] Circuit breaker / timeout / retry policy (ở gateway hoặc caller service)
- [ ] Document API contracts và versioning

---

## 12) Support

Nếu có vấn đề về integration, liên hệ team phát triển SeatNow.
