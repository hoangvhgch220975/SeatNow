# TECH STACK & ARCHITECTURE CHI TIẾT
## Nền tảng đặt bàn đa đối tác (SeatNow)

---

## 1) TECH STACK ĐẦY ĐỦ

### Frontend
```json
{
  "framework": "React 18 + TypeScript",
  "styling": "Tailwind CSS 3.x",
  "stateManagement": "Zustand",
  "routing": "React Router v6",
  "forms": "React Hook Form + Zod",
  "api": "Axios + React Query (TanStack Query)",
  "ui": "Shadcn/ui + Lucide Icons",
  "maps": "Leaflet / Google Maps API",
  "qrcode": "qrcode.react",
  "charts": "Recharts",
  "notifications": "React Hot Toast",
  "dateTime": "date-fns",
  "imageUpload": "react-dropzone"
}
```

### Backend
> Có thể triển khai bằng **JavaScript hoặc TypeScript**, giữ Express làm framework chính.

```json
{
  "runtime": "Node.js 20 LTS",
  "framework": "Express.js",
  "language": "JavaScript/TypeScript",
  "validation": "Joi / Zod",
  "authentication": "JWT + Passport.js",
  "fileUpload": "Multer + Sharp (image processing)",
  "security": "Helmet, express-rate-limit, cors",
  "logging": "Winston + Morgan",
  "scheduling": "node-cron",
  "websocket": "Socket.io"
}
```

### Database (KHÔNG DÙNG PRISMA)
```json
{
  "primary": "SQL Server 2022 (SQL)",
  "document": "MongoDB 7.x",
  "cache": "Redis 7.x",
  "sql_driver": "mssql (node-mssql)",
  "odm_mongo": "Mongoose"
}
```

#### Phân chia trách nhiệm dữ liệu
- **SQL Server**: Users, Restaurants, Tables, Bookings, Wallets, Transactions (quan hệ chặt chẽ, cần transaction)
- **MongoDB**: Reviews, Menu Items, Analytics Events (schema linh hoạt, dễ mở rộng)
- **Redis**: Sessions, OTP, Rate limiting, distributed lock, cache truy vấn, realtime availability

> Ghi chú: các field dạng “mảng/JSON” như `cuisineType`, `images`, `openingHours`, `depositPolicy` có thể lưu dưới dạng `NVARCHAR(MAX)` chứa JSON (SQL Server hỗ trợ truy vấn JSON qua `JSON_VALUE`, `OPENJSON`).

### Payment & Integration
```json
{
  "payment": [
    "VNPay SDK",
    "Momo SDK",
    "ZaloPay SDK",
    "VietQR Standard"
  ],
  "sms": "Twilio / SMSAPI.vn",
  "email": "Nodemailer + SendGrid",
  "cloudStorage": "AWS S3 / Cloudinary",
  "maps": "Google Maps API / Mapbox",
  "analytics": "Google Analytics 4 + Mixpanel"
}
```

### DevOps & Infrastructure
```json
{
  "containerization": "Docker + Docker Compose",
  "ci_cd": "GitHub Actions",
  "hosting_backend": "AWS EC2 / DigitalOcean",
  "hosting_frontend": "Vercel / Netlify",
  "cdn": "Cloudflare",
  "monitoring": "PM2 + New Relic / Datadog",
  "errorTracking": "Sentry",
  "loadBalancer": "Nginx"
}
```

---

## 2) KIẾN TRÚC HỆ THỐNG

### 2.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├──────────────────┬──────────────────┬───────────────────────┤
│  Web App (React) │  Mobile (Flutter)│  Restaurant Dashboard  │
└────────┬─────────┴─────────┬────────┴───────────┬───────────┘
         │                   │                    │
         └───────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Load Balancer │
                    │     (Nginx)     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ API     │        │ API     │        │ API     │
    │ Server 1│        │ Server 2│        │ Server 3│
    └────┬────┘        └────┬────┘        └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │SQL Server│       │ MongoDB │        │  Redis  │
    │ (Main DB)│       │ (Docs)  │        │ (Cache) │
    └──────────┘       └─────────┘        └─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │  Queue  │        │   S3    │        │ Payment │
    │ (Bull)  │        │(Storage)│        │ Gateway │
    └─────────┘        └─────────┘        └─────────┘
```

### 2.2 Project Structure (Monorepo)
> Giữ nguyên cấu trúc service như cũ; các service dùng SQL Server sẽ theo pattern: `config/db.js` + `models/*.sql.js` (raw SQL qua `mssql`).

```
SeatNow/
├── services/
│   ├── api-gateway/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   └── redis.js
│   │       ├── index.js
│   │       ├── routes/
│   │       │   └── proxy.routes.js
│   │       ├── middlewares/
│   │       │   ├── logging.middleware.js
│   │       │   └── auth-proxy.middleware.js
│   │       └── utils/
│   │           └── service-discovery.js
│   │
│   ├── auth-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js
│   │       │   ├── firebase.js
│   │       │   └── redis.js
│   │       ├── index.js
│   │       ├── controllers/
│   │       │   └── auth.controller.js
│   │       ├── services/
│   │       │   └── auth.service.js
│   │       ├── models/
│   │       │   └── user.model.js
│   │       ├── routes/
│   │       │   └── auth.route.js
│   │       ├── middlewares/
│   │       │   └── jwt.middleware.js
│   │       └── utils/
│   │           └── otp.util.js
│   │
│   ├── user-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   └── db.js
│   │       ├── index.js
│   │       ├── controllers/
│   │       │   └── user.controller.js
│   │       ├── services/
│   │       │   └── user.service.js
│   │       ├── models/
│   │       │   └── user.sql.js
│   │       ├── routes/
│   │       │   └── user.route.js
│   │       ├── validators/
│   │       │   └── user.validator.js
│   │       └── utils/
│   │           └── pagination.js
│   │
│   ├── restaurant-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   ├── sql.js
│   │       │   └── mongo.js
│   │       ├── index.js
│   │       ├── controllers/
│   │       │   └── restaurant.controller.js
│   │       ├── services/
│   │       │   ├── restaurant.service.js
│   │       │   └── menu.service.js
│   │       ├── models/
│   │       │   ├── restaurant.sql.js
│   │       │   └── menu.mongo.js
│   │       ├── routes/
│   │       │   └── restaurant.route.js
│   │       ├── middlewares/
│   │       │   └── rateLimit.middleware.js
│   │       └── utils/
│   │           └── availability.js
│   │
│   ├── booking-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js
│   │       │   └── redis.js
│   │       ├── index.js
│   │       ├── controllers/
│   │       │   └── booking.controller.js
│   │       ├── services/
│   │       │   └── booking.service.js
│   │       ├── models/
│   │       │   └── booking.sql.js
│   │       ├── routes/
│   │       │   └── booking.route.js
│   │       ├── jobs/
│   │       │   └── bookingExpire.job.js
│   │       ├── sockets/
│   │       │   └── booking.socket.js
│   │       └── utils/
│   │           └── lock.redis.js
│   │
│   ├── payment-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   └── db.js
│   │       ├── index.js
│   │       ├── controllers/
│   │       │   └── payment.controller.js
│   │       ├── services/
│   │       │   ├── payment.service.js
│   │       │   └── qr.service.js
│   │       ├── routes/
│   │       │   └── payment.route.js
│   │       └── utils/
│   │           └── webhook.validator.js
│   │
│   ├── notification-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── config/
│   │       │   └── redis.js
│   │       ├── index.js
│   │       ├── services/
│   │       │   ├── sms.service.js
│   │       │   └── email.service.js
│   │       └── queues/
│   │           └── notification.queue.js
│   │
│   └── admin-service/
│       ├── Dockerfile
│       ├── package.json
│       ├── .env.example
│       └── src/
│           ├── config/
│           │   ├── sql.js
│           │   └── mongo.js
│           ├── index.js
│           ├── controllers/
│           │   └── admin.controller.js
│           ├── services/
│           │   └── admin.service.js
│           └── routes/
│               └── admin.route.js
│
├── packages/
│   ├── common/
│   │   ├── package.json
│   │   └── src/
│   │       ├── logger.js
│   │       ├── errors.js
│   │       └── redis.client.js
│   └── types/
│       ├── package.json
│       └── src/
│           └── api-types.js
│
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── nginx/
│       └── gateway.conf
│
├── scripts/
│   ├── build-all.ps1
│   └── deploy-all.ps1
│
├── terraform/
│   └── main.tf
│
└── README.md
```

---

## 3) DATABASE SCHEMAS

### 3.1 SQL Server 2022 (DDL đề xuất) — **KHÔNG DÙNG PRISMA**
> Lưu ý:
> - Tránh dùng tên bảng `User` (keyword/nhạy). Đề xuất đặt `Users`.
> - Các field JSON lưu `NVARCHAR(MAX)` (có thể validate JSON bằng `ISJSON()` nếu cần).
> - `createdAt/updatedAt` dùng `DATETIME2` (UTC).

```sql
-- USERS
CREATE TABLE dbo.Users (
  id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  phone         NVARCHAR(20) NOT NULL,
  email         NVARCHAR(255) NULL,
  name          NVARCHAR(100) NOT NULL,
  password      NVARCHAR(255) NOT NULL,
  role          NVARCHAR(30)  NOT NULL,
  avatar        NVARCHAR(1024) NULL,
  loyaltyPoints INT NOT NULL DEFAULT 0,
  createdAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Users PRIMARY KEY (id),
  CONSTRAINT UQ_Users_phone UNIQUE (phone),
  CONSTRAINT UQ_Users_email UNIQUE (email),
  CONSTRAINT CK_Users_role CHECK (role IN ('CUSTOMER','RESTAURANT_OWNER','ADMIN'))
);

-- RESTAURANTS
CREATE TABLE dbo.Restaurants (
  id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  ownerId          UNIQUEIDENTIFIER NOT NULL,
  name             NVARCHAR(150) NOT NULL,
  slug             NVARCHAR(200) NOT NULL,
  address          NVARCHAR(255) NOT NULL,
  latitude         FLOAT NOT NULL,
  longitude        FLOAT NOT NULL,
  phone            NVARCHAR(20) NOT NULL,
  email            NVARCHAR(255) NULL,

  cuisineTypeJson  NVARCHAR(MAX) NULL,   -- JSON array
  priceRange       INT NOT NULL,         -- 1-4
  ratingAvg        FLOAT NOT NULL DEFAULT 0,
  ratingCount      INT NOT NULL DEFAULT 0,

  description      NVARCHAR(MAX) NULL,
  imagesJson       NVARCHAR(MAX) NULL,   -- JSON array
  openingHoursJson NVARCHAR(MAX) NULL,   -- JSON object

  depositEnabled   BIT NOT NULL DEFAULT 0,
  depositPolicyJson NVARCHAR(MAX) NULL,  -- JSON object

  commissionRate   FLOAT NOT NULL DEFAULT 10,
  status           NVARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, active, suspended
  isPremium        BIT NOT NULL DEFAULT 0,

  createdAt        DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt        DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Restaurants PRIMARY KEY (id),
  CONSTRAINT UQ_Restaurants_slug UNIQUE (slug),
  CONSTRAINT FK_Restaurants_owner FOREIGN KEY (ownerId) REFERENCES dbo.Users(id),
  CONSTRAINT CK_Restaurants_priceRange CHECK (priceRange BETWEEN 1 AND 4),
  CONSTRAINT CK_Restaurants_status CHECK (status IN ('pending','active','suspended'))
);

-- TABLES
CREATE TABLE dbo.Tables (
  id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  restaurantId  UNIQUEIDENTIFIER NOT NULL,
  tableNumber   NVARCHAR(50) NOT NULL,
  capacity      INT NOT NULL,
  type          NVARCHAR(30) NOT NULL DEFAULT 'normal', -- normal, vip, outdoor
  location      NVARCHAR(100) NULL,
  status        NVARCHAR(30) NOT NULL DEFAULT 'available',
  createdAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Tables PRIMARY KEY (id),
  CONSTRAINT FK_Tables_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  CONSTRAINT CK_Tables_type CHECK (type IN ('normal','vip','outdoor')),
  CONSTRAINT CK_Tables_status CHECK (status IN ('available','unavailable','maintenance'))
);

-- WALLETS (mỗi user/restaurant có tối đa 1 wallet)
CREATE TABLE dbo.Wallets (
  id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  userId        UNIQUEIDENTIFIER NULL,
  restaurantId  UNIQUEIDENTIFIER NULL,
  balance       FLOAT NOT NULL DEFAULT 0,
  lockedAmount  FLOAT NOT NULL DEFAULT 0,
  createdAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Wallets PRIMARY KEY (id),
  CONSTRAINT UQ_Wallets_userId UNIQUE (userId),
  CONSTRAINT UQ_Wallets_restaurantId UNIQUE (restaurantId),
  CONSTRAINT FK_Wallets_user FOREIGN KEY (userId) REFERENCES dbo.Users(id),
  CONSTRAINT FK_Wallets_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  CONSTRAINT CK_Wallets_owner CHECK (
    (userId IS NOT NULL AND restaurantId IS NULL)
    OR (userId IS NULL AND restaurantId IS NOT NULL)
  )
);

-- BOOKINGS
CREATE TABLE dbo.Bookings (
  id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  bookingCode     NVARCHAR(30) NOT NULL,
  customerId      UNIQUEIDENTIFIER NOT NULL,
  restaurantId    UNIQUEIDENTIFIER NOT NULL,
  tableId         UNIQUEIDENTIFIER NULL,
  bookingDate     DATE NOT NULL,
  bookingTime     NVARCHAR(10) NOT NULL, -- "19:00"
  numGuests       INT NOT NULL,
  status          NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
  notes           NVARCHAR(MAX) NULL,

  depositRequired BIT NOT NULL DEFAULT 0,
  depositAmount   FLOAT NULL,
  depositPaid     BIT NOT NULL DEFAULT 0,
  depositPaidAt   DATETIME2(3) NULL,
  depositRefunded BIT NOT NULL DEFAULT 0,

  commissionFee   FLOAT NULL,
  commissionPaid  BIT NOT NULL DEFAULT 0,

  confirmedAt     DATETIME2(3) NULL,
  checkedInAt     DATETIME2(3) NULL,
  completedAt     DATETIME2(3) NULL,
  cancelledAt     DATETIME2(3) NULL,

  createdAt       DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt       DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Bookings PRIMARY KEY (id),
  CONSTRAINT UQ_Bookings_bookingCode UNIQUE (bookingCode),
  CONSTRAINT FK_Bookings_customer FOREIGN KEY (customerId) REFERENCES dbo.Users(id),
  CONSTRAINT FK_Bookings_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  CONSTRAINT FK_Bookings_table FOREIGN KEY (tableId) REFERENCES dbo.Tables(id),
  CONSTRAINT CK_Bookings_status CHECK (status IN ('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','NO_SHOW'))
);

-- TRANSACTIONS
CREATE TABLE dbo.Transactions (
  id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  walletId      UNIQUEIDENTIFIER NOT NULL,
  bookingId     UNIQUEIDENTIFIER NULL,

  type          NVARCHAR(30) NOT NULL,
  amount        FLOAT NOT NULL,
  balanceBefore FLOAT NOT NULL,
  balanceAfter  FLOAT NOT NULL,

  description   NVARCHAR(MAX) NULL,
  paymentMethod NVARCHAR(50) NULL,
  referenceCode NVARCHAR(100) NULL,

  status        NVARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, completed, failed
  createdAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Transactions PRIMARY KEY (id),
  CONSTRAINT FK_Transactions_wallet FOREIGN KEY (walletId) REFERENCES dbo.Wallets(id),
  CONSTRAINT FK_Transactions_booking FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id),
  CONSTRAINT CK_Transactions_type CHECK (type IN ('TOP_UP','DEPOSIT_PAYMENT','DEPOSIT_REFUND','COMMISSION_FEE','WITHDRAWAL')),
  CONSTRAINT CK_Transactions_status CHECK (status IN ('pending','completed','failed'))
);

-- Indexes (khuyến nghị)
CREATE INDEX IX_Restaurants_ownerId ON dbo.Restaurants(ownerId);
CREATE INDEX IX_Tables_restaurantId ON dbo.Tables(restaurantId);
CREATE INDEX IX_Bookings_customerId ON dbo.Bookings(customerId);
CREATE INDEX IX_Bookings_restaurantId ON dbo.Bookings(restaurantId);
CREATE INDEX IX_Bookings_slot ON dbo.Bookings(restaurantId, bookingDate, bookingTime);
CREATE INDEX IX_Transactions_walletId ON dbo.Transactions(walletId);
CREATE INDEX IX_Transactions_bookingId ON dbo.Transactions(bookingId);
```

### 3.2 MongoDB (Mongoose Schemas) — Đã bỏ ActivityLog
```javascript
// models/mongo/Review.ts
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  customerId: { type: String, required: true },
  restaurantId: { type: String, required: true },

  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  images: [{ type: String }],

  foodRating: { type: Number, min: 1, max: 5 },
  serviceRating: { type: Number, min: 1, max: 5 },
  atmosphereRating: { type: Number, min: 1, max: 5 },

  isVerified: { type: Boolean, default: true },
  helpful: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

export const Review = mongoose.model('Review', reviewSchema);


// models/mongo/MenuItem.ts
const menuItemSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },

  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  discountPrice: { type: Number },

  category: { type: String },
  images: [{ type: String }],

  isAvailable: { type: Boolean, default: true },
  preparationTime: { type: Number },

  tags: [{ type: String }],
  allergens: [{ type: String }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);
```

### 3.3 Redis Structure (Key patterns)
```javascript
// Sessions
SET user:session:{sessionId} {userId, role, exp}  EX 86400

// OTP codes
SET otp:{phone} {code}  EX 300

// Rate limiting
INCR ratelimit:{ip}:{endpoint}  EX 60

// Realtime table availability
SET restaurant:{id}:tables:available [tableId1, tableId2, ...]  EX 300

// Booking lock (prevent double booking)
SET booking:lock:{restaurantId}:{date}:{time}  "locked"  EX 60

// Cache popular restaurants
SET cache:restaurants:trending {data}  EX 3600

// Queue for payment webhook
LPUSH queue:payment:webhook {webhookData}
```

---

## 4) API ENDPOINTS CHI TIẾT

### 4.1 Authentication
```javascript
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/google-signin
```

### 4.2 User
```javascript
GET    /api/v1/users/me
PUT    /api/v1/users/me
GET    /api/v1/users/me/bookings
GET    /api/v1/users/me/wallet
GET    /api/v1/users/me/loyalty-points
```

### 4.3 Restaurant
```javascript
GET    /api/v1/restaurants
GET    /api/v1/restaurants/:id
GET    /api/v1/restaurants/:id/menu
GET    /api/v1/restaurants/:id/reviews
GET    /api/v1/restaurants/:id/availability

POST   /api/v1/restaurants
PUT    /api/v1/restaurants/:id
DELETE /api/v1/restaurants/:id
POST   /api/v1/restaurants/:id/menu
PUT    /api/v1/restaurants/:id/menu/:itemId
DELETE /api/v1/restaurants/:id/menu/:itemId
PUT    /api/v1/restaurants/:id/deposit-policy
GET    /api/v1/restaurants/:id/bookings
GET    /api/v1/restaurants/:id/dashboard
```

### 4.4 Booking
```javascript
POST   /api/v1/bookings
GET    /api/v1/bookings/:id
PUT    /api/v1/bookings/:id/cancel
POST   /api/v1/bookings/:id/check-in
POST   /api/v1/bookings/:id/complete
POST   /api/v1/bookings/:id/review
PUT    /api/v1/bookings/:id/confirm
PUT    /api/v1/bookings/:id/reject
```

### 4.5 Payment
```javascript
POST   /api/v1/payment/deposit/generate-qr
POST   /api/v1/payment/webhook/vnpay
POST   /api/v1/payment/webhook/momo
GET    /api/v1/payment/transaction/:id

POST   /api/v1/wallet/topup
POST   /api/v1/wallet/withdraw
GET    /api/v1/wallet/transactions
```

### 4.6 Admin
```javascript
GET    /api/v1/admin/restaurants/pending
PUT    /api/v1/admin/restaurants/:id/approve
PUT    /api/v1/admin/restaurants/:id/suspend
GET    /api/v1/admin/users
GET    /api/v1/admin/bookings
GET    /api/v1/admin/dashboard/stats
GET    /api/v1/admin/transactions
```

---

## 5) CORE SERVICES IMPLEMENTATION (SQL Server + `mssql`)

### 5.1 DB helper (dùng chung cho các service SQL)
```javascript
// src/config/db.js
const sql = require('mssql');

let pool;

function getConfig() {
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() === 'true'
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
  };
}

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(getConfig());
  return pool;
}

module.exports = { sql, getPool };
```

### 5.2 Payment Service với VietQR (không phụ thuộc Prisma)
```javascript
// services/qrcode.service.ts
import QRCode from 'qrcode';

interface QRCodeData {
  bankCode: string;
  accountNo: string;
  accountName: string;
  amount: number;
  description: string;
  template?: string;
}

export class QRCodeService {
  async generateVietQR(data: QRCodeData): Promise<string> {
    const { bankCode, accountNo, amount, description, template = 'compact' } = data;
    const qrUrl =
      `https://img.vietqr.io/image/${bankCode}-${accountNo}-${template}.jpg` +
      `?amount=${amount}&addInfo=${encodeURIComponent(description)}`;
    return qrUrl;
  }

  async generateQRCodeBuffer(text: string): Promise<Buffer> {
    return await QRCode.toBuffer(text);
  }
}
```

### 5.3 Booking Service (raw SQL + transaction)
```javascript
// services/booking.service.js
const { sql, getPool } = require('../config/db');
const { RedisClient } = require('../config/redis');

const redis = RedisClient.getInstance();

class BookingService {
  async createBooking(data) {
    const { restaurantId, customerId, bookingDate, bookingTime, numGuests } = data;

    const pool = await getPool();

    // 1) Lấy deposit policy + commissionRate từ Restaurants
    const restaurantRes = await pool.request()
      .input('restaurantId', sql.UniqueIdentifier, restaurantId)
      .query(`
        SELECT TOP 1 id, depositEnabled, depositPolicyJson, commissionRate
        FROM dbo.Restaurants
        WHERE id = @restaurantId
      `);

    const restaurant = restaurantRes.recordset[0];
    if (!restaurant) throw new Error('Restaurant not found');

    // 2) Tính deposit
    let depositRequired = false;
    let depositAmount = 0;

    if (restaurant.depositEnabled) {
      try {
        const policy = restaurant.depositPolicyJson ? JSON.parse(restaurant.depositPolicyJson) : null;
        if (policy && numGuests >= policy.minGuests) {
          depositRequired = true;
          depositAmount = policy.type === 'per_person' ? (policy.amount * numGuests) : policy.amount;
        }
      } catch (_) {}
    }

    // 3) Distributed lock
    const lockKey = `booking:lock:${restaurantId}:${bookingDate}:${bookingTime}`;
    const locked = await redis.set(lockKey, 'locked', 'EX', 60, 'NX');
    if (!locked) throw new Error('This time slot is being booked by someone else');

    // 4) Insert booking (transaction)
    const bookingCode = this.generateBookingCode();
    const status = depositRequired ? 'PENDING' : 'CONFIRMED';
    const commissionFee = depositRequired ? (depositAmount * (restaurant.commissionRate / 100)) : 0;

    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const req = new sql.Request(tx);

      const insertRes = await req
        .input('bookingCode', sql.NVarChar(30), bookingCode)
        .input('customerId', sql.UniqueIdentifier, customerId)
        .input('restaurantId', sql.UniqueIdentifier, restaurantId)
        .input('bookingDate', sql.Date, bookingDate) // 'YYYY-MM-DD'
        .input('bookingTime', sql.NVarChar(10), bookingTime)
        .input('numGuests', sql.Int, numGuests)
        .input('status', sql.NVarChar(30), status)
        .input('depositRequired', sql.Bit, depositRequired ? 1 : 0)
        .input('depositAmount', sql.Float, depositRequired ? depositAmount : null)
        .input('commissionFee', sql.Float, commissionFee || null)
        .query(`
          INSERT INTO dbo.Bookings (
            bookingCode, customerId, restaurantId,
            bookingDate, bookingTime, numGuests,
            status, depositRequired, depositAmount, commissionFee
          )
          OUTPUT INSERTED.*
          VALUES (
            @bookingCode, @customerId, @restaurantId,
            @bookingDate, @bookingTime, @numGuests,
            @status, @depositRequired, @depositAmount, @commissionFee
          )
        `);

      await tx.commit();
      return { booking: insertRes.recordset[0], depositRequired, depositAmount };
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      await redis.del(lockKey);
    }
  }

  generateBookingCode() {
    const date = new Date();
    const yyyy = date.getUTCFullYear().toString();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BK${yyyy}${mm}${dd}${random}`;
  }
}

module.exports = { BookingService };
```

### 5.4 Wallet Service (raw SQL + transaction)
```javascript
// services/wallet.service.js
const { sql, getPool } = require('../config/db');

class WalletService {
  async topUp(restaurantId, amount, paymentMethod) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      const req = new sql.Request(tx);

      const walletRes = await req
        .input('restaurantId', sql.UniqueIdentifier, restaurantId)
        .query(`SELECT TOP 1 * FROM dbo.Wallets WHERE restaurantId = @restaurantId`);

      const wallet = walletRes.recordset[0];
      if (!wallet) throw new Error('Wallet not found');

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      await req
        .input('walletId', sql.UniqueIdentifier, wallet.id)
        .input('balanceAfter', sql.Float, balanceAfter)
        .query(`
          UPDATE dbo.Wallets
          SET balance = @balanceAfter, updatedAt = SYSUTCDATETIME()
          WHERE id = @walletId
        `);

      await req
        .input('walletId2', sql.UniqueIdentifier, wallet.id)
        .input('type', sql.NVarChar(30), 'TOP_UP')
        .input('amount', sql.Float, amount)
        .input('balanceBefore', sql.Float, balanceBefore)
        .input('balanceAfter2', sql.Float, balanceAfter)
        .input('paymentMethod', sql.NVarChar(50), paymentMethod)
        .input('status', sql.NVarChar(30), 'completed')
        .query(`
          INSERT INTO dbo.Transactions (walletId, type, amount, balanceBefore, balanceAfter, paymentMethod, status)
          VALUES (@walletId2, @type, @amount, @balanceBefore, @balanceAfter2, @paymentMethod, @status)
        `);

      await tx.commit();
      return { walletId: wallet.id, balanceBefore, balanceAfter, amount };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }
}

module.exports = { WalletService };
```

---

## 6) FRONTEND IMPLEMENTATION

### 6.1 API Service (Axios + React Query)
```javascript
// services/api.js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// services/bookingService.js
import { api } from './api';

export const bookingService = {
  create: async (data) => (await api.post('/bookings', data)).data,
  getMyBookings: async () => (await api.get('/users/me/bookings')).data,
  cancel: async (id) => (await api.put(`/bookings/${id}/cancel`)).data
};
```

### 6.2 State Management (Zustand)
```javascript
// store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      }
    }),
    { name: 'auth-storage' }
  )
);
```
