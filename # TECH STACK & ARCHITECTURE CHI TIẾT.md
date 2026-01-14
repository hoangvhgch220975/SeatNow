# TECH STACK & ARCHITECTURE CHI TIẾT
## Platform Đặt Bàn Đa Đối Tác

---

## 1. TECH STACK ĐẦY ĐỦ

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
```json
{
  "runtime": "Node.js 20 LTS",
  "framework": "Express.js",
  "language": "JavaScript",
  "validation": "Joi / Zod",
  "authentication": "JWT + Passport.js",
  "fileUpload": "Multer + Sharp (image processing)",
  "security": "Helmet, express-rate-limit, cors",
  "logging": "Winston + Morgan",
  "scheduling": "node-cron",
  "websocket": "Socket.io"
}
```

### Database
```json
{
  "primary": "SQL Server 2022 (SQL)",
  "document": "MongoDB 7.x",
  "cache": "Redis 7.x",
  "orm_sql": "Prisma",
  "odm_mongo": "Mongoose"
}
```

**Phân chia trách nhiệm:**
- **SQL Server**: Users, Restaurants, Bookings, Transactions, Tables (dữ liệu quan hệ chặt chẽ)
- **MongoDB**: Reviews, Logs, Analytics Events, Menu Items (dữ liệu linh hoạt, schema thay đổi)
- **Redis**: Sessions, OTP codes, Rate limiting, Real-time availability, Cache queries

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

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
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

### 2.2 Project Structure

```
SeatNow/
├── services/
│   ├── api-gateway/
│   │   ├── Dockerfile             # Build image cho Gateway
│   │   ├── package.json           # Dependencies: express, http-proxy-middleware
│   │   ├── .env.example           # Chứa: PORT, REDIS_URL, SERVICE_URLS (Auth, User...)
│   │   └── src/
│   │       ├── config/
│   │       │   └── redis.js       # Kết nối Redis: Dùng cho Rate Limiting & Caching
│   │       ├── index.js           # Entry point: Khởi tạo server, cấu hình proxy
│   │       ├── routes/
│   │       │   └── proxy.routes.js # Định nghĩa các route để forward request
│   │       ├── middlewares/
│   │       │   ├── logging.middleware.js    # Log mọi request đi qua gateway
│   │       │   └── auth-proxy.middleware.js # Decode JWT sơ bộ (nếu cần)
│   │       └── utils/
│   │           └── service-discovery.js     # Map tên service sang URL/IP
│   │
│   ├── auth-service/
│   │   ├── Dockerfile             # Build image Auth Service
│   │   ├── package.json           # Dependencies: jsonwebtoken, bcrypt, prisma
│   │   ├── .env.example           # Chứa: DATABASE_URL (SQL), REDIS_URL, JWT_SECRET
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js          # Kết nối SQL Server (Prisma) để lưu User/Account
│   │       │   └── redis.js       # Kết nối Redis để lưu OTP và Session đăng nhập
│   │       ├── index.js           # Entry point
│   │       ├── controllers/
│   │       │   └── auth.controller.js # Xử lý logic đăng ký, đăng nhập, logout
│   │       ├── services/
│   │       │   └── auth.service.js    # Logic nghiệp vụ: hash pass, sign token
│   │       ├── models/
│   │       │   └── user.model.js      # (Optional) Wrapper quanh Prisma model
│   │       ├── routes/
│   │       │   └── auth.route.js      # Định nghĩa API: /login, /register
│   │       ├── middlewares/
│   │       │   └── jwt.middleware.js  # Middleware xác thực token nội bộ
│   │       └── utils/
│   │           └── otp.util.js        # Sinh và kiểm tra mã OTP
│   │
│   ├── user-service/
│   │   ├── Dockerfile             # Build image User Service
│   │   ├── package.json           # Dependencies: prisma, joi/zod
│   │   ├── .env.example           # Chứa: DATABASE_URL (SQL)
│   │   └── src/
│   │       ├── config/
│   │       │   └── db.js          # Kết nối SQL Server (Prisma) để truy vấn Profile
│   │       ├── index.js           # Entry point
│   │       ├── controllers/
│   │       │   └── user.controller.js # Xử lý CRUD profile, settings
│   │       ├── services/
│   │       │   └── user.service.js    # Logic nghiệp vụ user
│   │       ├── models/
│   │       │   └── user.sql.js        # Data access layer cho User
│   │       ├── routes/
│   │       │   └── user.route.js      # API: /me, /profile, /update
│   │       ├── validators/
│   │       │   └── user.validator.js  # Validate dữ liệu đầu vào (Zod/Joi)
│   │       └── utils/
│   │           └── pagination.js      # Helper phân trang danh sách
│   │
│   ├── restaurant-service/
│   │   ├── Dockerfile             # Build image Restaurant Service
│   │   ├── package.json           # Dependencies: mongoose, prisma
│   │   ├── .env.example           # Chứa: DATABASE_URL (SQL), MONGO_URI (NoSQL)
│   │   └── src/
│   │       ├── config/
│   │       │   ├── sql.js         # Kết nối SQL Server: Lưu thông tin nhà hàng, bàn
│   │       │   └── mongo.js       # Kết nối MongoDB: Lưu Menu items (schema động)
│   │       ├── index.js           # Entry point
│   │       ├── controllers/
│   │       │   └── restaurant.controller.js # Xử lý tìm kiếm, chi tiết nhà hàng
│   │       ├── services/
│   │       │   ├── restaurant.service.js    # Logic quản lý nhà hàng
│   │       │   └── menu.service.js          # Logic quản lý thực đơn (Mongo)
│   │       ├── models/
│   │       │   ├── restaurant.sql.js        # Prisma model: Restaurant, Table
│   │       │   └── menu.mongo.js            # Mongoose schema: MenuItem, Review
│   │       ├── routes/
│   │       │   └── restaurant.route.js      # API: /restaurants, /menu
│   │       ├── middlewares/
│   │       │   └── rateLimit.middleware.js  # Giới hạn request spam
│   │       └── utils/
│   │           └── availability.js          # Tính toán bàn trống
│   │
│   ├── booking-service/
│   │   ├── Dockerfile             # Build image Booking Service
│   │   ├── package.json           # Dependencies: bull, redis, prisma
│   │   ├── .env.example           # Chứa: DATABASE_URL, REDIS_URL
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js          # Kết nối SQL Server: Lưu đơn đặt bàn (Booking)
│   │       │   └── redis.js       # Kết nối Redis: Dùng cho Distributed Lock (tránh trùng lịch)
│   │       ├── index.js           # Entry point
│   │       ├── controllers/
│   │       │   └── booking.controller.js    # Xử lý tạo, hủy, xác nhận booking
│   │       ├── services/
│   │       │   └── booking.service.js       # Logic đặt bàn, check lock
│   │       ├── models/
│   │       │   └── booking.sql.js           # Prisma model: Booking
│   │       ├── routes/
│   │       │   └── booking.route.js         # API: /bookings
│   │       ├── jobs/
│   │       │   └── bookingExpire.job.js     # Cron job hủy đơn quá hạn/chưa cọc
│   │       ├── sockets/
│   │       │   └── booking.socket.js        # Real-time update trạng thái bàn
│   │       └── utils/
│   │           └── lock.redis.js            # Helper tạo Distributed Lock
│   │
│   ├── payment-service/
│   │   ├── Dockerfile             # Build image Payment Service
│   │   ├── package.json           # Dependencies: axios, crypto
│   │   ├── .env.example           # Chứa: DATABASE_URL, VNPAY_HASH_SECRET, MOMO_KEYS
│   │   └── src/
│   │       ├── config/
│   │       │   └── db.js          # Kết nối SQL Server: Lưu Transaction & Wallet
│   │       ├── index.js           # Entry point
│   │       ├── controllers/
│   │       │   └── payment.controller.js    # Xử lý tạo QR, webhook
│   │       ├── services/
│   │       │   ├── payment.service.js       # Logic xử lý giao dịch, ví
│   │       │   └── qr.service.js            # Tạo mã VietQR
│   │       ├── routes/
│   │       │   └── payment.route.js         # API: /payment, /webhook
│   │       └── utils/
│   │           └── webhook.validator.js     # Xác thực chữ ký (checksum) từ cổng thanh toán
│   │
│   ├── notification-service/
│   │   ├── Dockerfile             # Build image Notification Service
│   │   ├── package.json           # Dependencies: nodemailer, twilio, bull
│   │   ├── .env.example           # Chứa: REDIS_URL (Queue), EMAIL_API_KEY, SMS_API_KEY
│   │   └── src/
│   │       ├── config/
│   │       │   └── redis.js       # Kết nối Redis: Xử lý Message Queue (Bull) gửi noti
│   │       ├── index.js           # Entry point: Khởi chạy Worker xử lý Queue
│   │       ├── services/
│   │       │   ├── sms.service.js           # Gửi SMS (Twilio/SpeedSMS)
│   │       │   └── email.service.js         # Gửi Email (SendGrid/Nodemailer)
│   │       └── queues/
│   │           └── notification.queue.js    # Định nghĩa Consumer xử lý job gửi tin
│   │
│   └── admin-service/
│       ├── Dockerfile             # Build image Admin Service
│       ├── package.json           # Dependencies: chart.js (server side?), export libs
│       ├── .env.example           # Chứa: DATABASE_URL, MONGO_URI
│       └── src/
│           ├── config/
│           │   ├── sql.js         # Kết nối SQL Server: Quản lý duyệt nhà hàng/user
│           │   └── mongo.js       # Kết nối MongoDB: Xem Logs, Reviews, Analytics
│           ├── index.js           # Entry point
│           ├── controllers/
│           │   └── admin.controller.js      # Xử lý các tác vụ quản trị
│           ├── services/
│           │   └── admin.service.js         # Logic duyệt, khóa, thống kê
│           └── routes/
│               └── admin.route.js           # API: /admin/*
│
├── packages/
│   ├── common/
│   │   ├── package.json           # Shared library dependencies
│   │   └── src/
│   │       ├── logger.js          # Cấu hình Winston/Morgan dùng chung
│   │       ├── errors.js          # Class lỗi chuẩn (BadRequestError, NotFoundError)
│   │       └── redis.client.js    # Wrapper kết nối Redis dùng chung
│   └── types/
│       ├── package.json           # Type definitions dependencies
│       └── src/
│           └── api-types.js       # Shared TypeScript interfaces/types
│
├── infra/
│   ├── docker-compose.yml         # Orchestration cho môi trường dev
│   ├── k8s/
│   │   ├── deployment.yaml        # K8s Deployment configs
│   │   └── service.yaml           # K8s Service configs
│   └── nginx/
│       └── gateway.conf           # Cấu hình Nginx Load Balancer (nếu dùng thay API Gateway node)
│
├── scripts/
│   ├── build-all.ps1              # Script build toàn bộ service
│   └── deploy-all.ps1             # Script deploy lên server/k8s
│
├── terraform/              # optional infra as code
│   └── main.tf                    # Cấu hình hạ tầng AWS/Cloud
│
└── README.md
```

---

## 3. DATABASE SCHEMAS

### 3.1 SQL Server (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

enum UserRole {
  CUSTOMER
  RESTAURANT_OWNER
  ADMIN
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CHECKED_IN
  COMPLETED
  CANCELLED
  NO_SHOW
}

model User {
  id            String    @id @default(uuid())
  phone         String    @unique
  email         String?   @unique
  name          String
  password      String
  role          UserRole  @default(CUSTOMER)
  avatar        String?
  loyaltyPoints Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  bookings      Booking[]
  restaurants   Restaurant[]
  wallet        Wallet?
}

model Restaurant {
  id              String   @id @default(uuid())
  ownerId         String
  owner           User     @relation(fields: [ownerId], references: [id])
  
  name            String
  slug            String   @unique
  address         String
  latitude        Float
  longitude       Float
  phone           String
  email           String?
  
  cuisineType     String[]
  priceRange      Int      // 1-4 ($, $$, $$$, $$$$)
  ratingAvg       Float    @default(0)
  ratingCount     Int      @default(0)
  
  description     String?
  images          String[]
  openingHours    Json     // {mon: "9:00-22:00", tue: ...}
  
  // Deposit policy
  depositEnabled  Boolean  @default(false)
  depositPolicy   Json?    // {minGuests: 6, amount: 100000, type: "per_person"}
  
  commissionRate  Float    @default(10) // %
  status          String   @default("pending") // pending, active, suspended
  isPremium       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tables          Table[]
  bookings        Booking[]
  wallet          Wallet?
}

model Table {
  id           String     @id @default(uuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  
  tableNumber  String
  capacity     Int
  type         String     @default("normal") // normal, vip, outdoor
  location     String?
  status       String     @default("available")
  
  bookings     Booking[]
}

model Booking {
  id              String        @id @default(uuid())
  bookingCode     String        @unique // BK20240112001
  
  customerId      String
  customer        User          @relation(fields: [customerId], references: [id])
  restaurantId    String
  restaurant      Restaurant    @relation(fields: [restaurantId], references: [id])
  tableId         String?
  table           Table?        @relation(fields: [tableId], references: [id])
  
  bookingDate     DateTime
  bookingTime     String        // "19:00"
  numGuests       Int
  
  status          BookingStatus @default(PENDING)
  notes           String?
  
  // Deposit
  depositRequired Boolean       @default(false)
  depositAmount   Float?
  depositPaid     Boolean       @default(false)
  depositPaidAt   DateTime?
  depositRefunded Boolean       @default(false)
  
  // Commission
  commissionFee   Float?
  commissionPaid  Boolean       @default(false)
  
  // Timestamps
  confirmedAt     DateTime?
  checkedInAt     DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  transactions    Transaction[]
}

model Wallet {
  id           String   @id @default(uuid())
  userId       String?  @unique
  user         User?    @relation(fields: [userId], references: [id])
  restaurantId String?  @unique
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id])
  
  balance      Float    @default(0)
  lockedAmount Float    @default(0) // Số tiền đang bị lock
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  transactions Transaction[]
}

enum TransactionType {
  TOP_UP
  DEPOSIT_PAYMENT
  DEPOSIT_REFUND
  COMMISSION_FEE
  WITHDRAWAL
}

model Transaction {
  id              String          @id @default(uuid())
  walletId        String
  wallet          Wallet          @relation(fields: [walletId], references: [id])
  
  bookingId       String?
  booking         Booking?        @relation(fields: [bookingId], references: [id])
  
  type            TransactionType
  amount          Float
  balanceBefore   Float
  balanceAfter    Float
  
  description     String?
  paymentMethod   String?         // bank_transfer, momo, vnpay
  referenceCode   String?         // Mã GD từ bank
  
  status          String          @default("pending") // pending, completed, failed
  
  createdAt       DateTime        @default(now())
}
```

### 3.2 MongoDB (Mongoose Schemas)

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
  
  category: { type: String }, // appetizer, main, dessert, drink
  images: [{ type: String }],
  
  isAvailable: { type: Boolean, default: true },
  preparationTime: { type: Number }, // minutes
  
  tags: [{ type: String }], // spicy, vegetarian, signature
  allergens: [{ type: String }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// models/mongo/ActivityLog.ts
const activityLogSchema = new mongoose.Schema({
  userId: { type: String },
  userRole: { type: String },
  action: { type: String, required: true }, // booking_created, payment_completed
  resourceType: { type: String }, // booking, restaurant, user
  resourceId: { type: String },
  
  metadata: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  
  timestamp: { type: Date, default: Date.now }
});

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
```

### 3.3 Redis Structure

```javascript
// Redis key patterns

// Sessions
SET user:session:{sessionId} {userId, role, exp}  EX 86400

// OTP codes
SET otp:{phone} {code}  EX 300  // 5 minutes

// Rate limiting
INCR ratelimit:{ip}:{endpoint}  EX 60

// Real-time table availability
SET restaurant:{id}:tables:available [tableId1, tableId2, ...]  EX 300

// Booking lock (prevent double booking)
SET booking:lock:{restaurantId}:{date}:{time}  "locked"  EX 60

// Cache popular restaurants
SET cache:restaurants:trending {data}  EX 3600

// Queue for payment webhook
LPUSH queue:payment:webhook {webhookData}
```

---

## 4. API ENDPOINTS CHI TIẾT

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
// Public
GET    /api/v1/restaurants                  // List + search + filter
GET    /api/v1/restaurants/:id              // Detail
GET    /api/v1/restaurants/:id/menu         // Menu items
GET    /api/v1/restaurants/:id/reviews      // Reviews
GET    /api/v1/restaurants/:id/availability // Check available slots

// Restaurant owner
POST   /api/v1/restaurants                  // Register
PUT    /api/v1/restaurants/:id
DELETE /api/v1/restaurants/:id
POST   /api/v1/restaurants/:id/menu         // Add menu item
PUT    /api/v1/restaurants/:id/menu/:itemId
DELETE /api/v1/restaurants/:id/menu/:itemId
PUT    /api/v1/restaurants/:id/deposit-policy
GET    /api/v1/restaurants/:id/bookings     // List bookings
GET    /api/v1/restaurants/:id/dashboard    // Stats
```

### 4.4 Booking

```javascript
POST   /api/v1/bookings                     // Create booking
GET    /api/v1/bookings/:id                 // Get detail
PUT    /api/v1/bookings/:id/cancel          // Cancel
POST   /api/v1/bookings/:id/check-in        // Check-in at restaurant
POST   /api/v1/bookings/:id/complete        // Mark complete
POST   /api/v1/bookings/:id/review          // Add review

// Restaurant confirms
PUT    /api/v1/bookings/:id/confirm
PUT    /api/v1/bookings/:id/reject
```

### 4.5 Payment

```javascript
POST   /api/v1/payment/deposit/generate-qr  // Generate QR for deposit
POST   /api/v1/payment/webhook/vnpay        // VNPay callback
POST   /api/v1/payment/webhook/momo         // Momo callback
GET    /api/v1/payment/transaction/:id      // Check status

// Wallet
POST   /api/v1/wallet/topup                 // Restaurant top-up
POST   /api/v1/wallet/withdraw              // Withdraw
GET    /api/v1/wallet/transactions          // Transaction history
```

### 4.6 Admin

```javascript
GET    /api/v1/admin/restaurants/pending    // Pending approval
PUT    /api/v1/admin/restaurants/:id/approve
PUT    /api/v1/admin/restaurants/:id/suspend
GET    /api/v1/admin/users
GET    /api/v1/admin/bookings
GET    /api/v1/admin/dashboard/stats
GET    /api/v1/admin/transactions
```

---

## 5. CORE SERVICES IMPLEMENTATION

### 5.1 Payment Service với VietQR

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
  // VietQR Standard format
  async generateVietQR(data: QRCodeData): Promise<string> {
    // Format: https://img.vietqr.io/image/{BANK_CODE}-{ACCOUNT_NO}-{TEMPLATE}.jpg
    // ?amount={AMOUNT}&addInfo={DESCRIPTION}
    
    const { bankCode, accountNo, amount, description, template = 'compact' } = data;
    
    const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNo}-${template}.jpg?amount=${amount}&addInfo=${encodeURIComponent(description)}`;
    
    return qrUrl;
  }
  
  async generateQRCodeBuffer(text: string): Promise<Buffer> {
    return await QRCode.toBuffer(text);
  }
}
```

### 5.2 Booking Service

```javascript
// services/booking.service.ts
import { PrismaClient } from '@prisma/client';
import { RedisClient } from '../config/redis';

const prisma = new PrismaClient();
const redis = RedisClient.getInstance();

export class BookingService {
  async createBooking(data: CreateBookingDTO) {
    const { restaurantId, customerId, bookingDate, bookingTime, numGuests } = data;
    
    // 1. Check restaurant deposit policy
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { wallet: true }
    });
    
    if (!restaurant) throw new Error('Restaurant not found');
    
    // 2. Check if deposit required
    let depositRequired = false;
    let depositAmount = 0;
    
    if (restaurant.depositEnabled && restaurant.depositPolicy) {
      const policy = restaurant.depositPolicy as any;
      
      if (numGuests >= policy.minGuests) {
        depositRequired = true;
        
        if (policy.type === 'per_person') {
          depositAmount = policy.amount * numGuests;
        } else {
          depositAmount = policy.amount;
        }
      }
    }
    
    // 3. Lock table slot to prevent double booking
    const lockKey = `booking:lock:${restaurantId}:${bookingDate}:${bookingTime}`;
    const locked = await redis.set(lockKey, 'locked', 'EX', 60, 'NX');
    
    if (!locked) {
      throw new Error('This time slot is being booked by someone else');
    }
    
    // 4. Generate booking code
    const bookingCode = this.generateBookingCode();
    
    // 5. Create booking
    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        customerId,
        restaurantId,
        bookingDate: new Date(bookingDate),
        bookingTime,
        numGuests,
        depositRequired,
        depositAmount,
        status: depositRequired ? 'PENDING' : 'CONFIRMED',
        commissionFee: depositAmount * (restaurant.commissionRate / 100)
      }
    });
    
    // 6. Release lock
    await redis.del(lockKey);
    
    return {
      booking,
      depositRequired,
      depositAmount
    };
  }
  
  private generateBookingCode(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BK${dateStr}${random}`;
  }
  
  async processDepositPayment(bookingId: string, transactionRef: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Update booking
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          depositPaid: true,
          depositPaidAt: new Date(),
          status: 'CONFIRMED'
        },
        include: { restaurant: true }
      });
      
      // 2. Create transaction record
      await tx.transaction.create({
        data: {
          walletId: booking.restaurant.walletId!,
          bookingId: booking.id,
          type: 'DEPOSIT_PAYMENT',
          amount: booking.depositAmount!,
          balanceBefore: 0,
          balanceAfter: 0,
          referenceCode: transactionRef,
          status: 'completed'
        }
      });
      
      // 3. Send confirmation SMS/Email
      // await this.notificationService.sendBookingConfirmation(booking);
      
      return booking;
    });
  }
}
```

### 5.3 Wallet Service

```javascript
// services/wallet.service.js
export class WalletService {
  async topUp(restaurantId: string, amount: number, paymentMethod: string) {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { restaurantId }
      });
      
      if (!wallet) throw new Error('Wallet not found');
      
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;
      
      // Update wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });
      
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOP_UP',
          amount,
          balanceBefore,
          balanceAfter,
          paymentMethod,
          status: 'completed'
        }
      });
      
      return transaction;
    });
  }
  
  async deductCommission(bookingId: string) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { restaurant: { include: { wallet: true } } }
      });
      
      if (!booking || !booking.commissionFee) return;
      
      const wallet = booking.restaurant.wallet!;
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - booking.commissionFee;
      
      // Update wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });
      
      // Create transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          bookingId: booking.id,
          type: 'COMMISSION_FEE',
          amount: booking.commissionFee,
          balanceBefore,
          balanceAfter,
          status: 'completed'
        }
      });
      
      // Mark commission as paid
      await tx.booking.update({
        where: { id: bookingId },
        data: { commissionPaid: true }
      });
    });
  }
}
```

---

## 6. FRONTEND IMPLEMENTATION

### 6.1 API Service (Axios + React Query)

```javascript
// services/api.js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor: Add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Handle errors
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
  create: async (data: CreateBookingDTO) => {
    const res = await api.post('/bookings', data);
    return res.data;
  },
  
  getMyBookings: async () => {
    const res = await api.get('/users/me/bookings');
    return res.data;
  },
  
  cancel: async (id: string) => {
    const res = await api.put(`/bookings/${id}/cancel`);
    return res.data;
  }
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
        localStorage.removeItem('token