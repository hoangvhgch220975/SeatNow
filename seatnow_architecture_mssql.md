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


**Promotion Service — Structure**

- `src/index.js`: express app, mount `routes/promotion.route.js`, health check
- `src/config/db.js`: `mssql` pool helper
- `src/controllers/promotion.controller.js`: handlers for validate/apply/CRUD
- `src/services/promotion.service.js`: business logic, validation helpers
- `src/models/promotion.sql.js`: raw SQL queries and transaction helpers
- `src/routes/promotion.route.js`: route definitions and auth middleware
- `src/validators/promotion.validator.js`: Joi/Zod schemas

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
SeatNow/                     # Thư mục gốc của dự án
├── services/                             # Chứa các microservices riêng biệt
│   ├── api-gateway/                      # Gateway service - proxy cho các service
│   │   ├── Dockerfile                   # Dockerfile: build image cho Gateway
│   │   ├── package.json                 # Khai báo dependency cho Gateway
│   │   ├── .env.example                 # Biến môi trường mẫu cho Gateway
│   │   └── src/                         # Mã nguồn Gateway
│   │       ├── config/                  # Cấu hình (Redis, v.v.)
│   │       │   └── redis.js             # Kết nối Redis: rate-limit, cache
│   │       ├── index.js                 # Entry point: khởi server + cấu hình proxy
│   │       ├── routes/                  # Định nghĩa route để forward
│   │       │   └── proxy.routes.js      # Map đường dẫn tới service tương ứng
│   │       ├── middlewares/             # Middlewares dùng chung cho Gateway
│   │       │   ├── logging.middleware.js    # Ghi log request
│   │       │   └── auth-proxy.middleware.js # Decode JWT sơ bộ (điều kiện routing)
│   │       └── utils/                   # Hàm tiện ích cho Gateway
│   │           └── service-discovery.js     # Map tên service sang URL/IP
│   │
│   ├── auth-service/                    # Authentication service (register/login, OTP)
│   │   ├── Dockerfile                   # Dockerfile Auth Service
│   │   ├── package.json                 # Dependencies cho Auth Service
│   │   ├── .env.example                 # Biến môi trường mẫu (DB, REDIS, JWT)
│   │   └── src/                         # Mã nguồn Auth Service
│   │       ├── config/                  # Cấu hình kết nối DB/Redis
│   │       │   ├── db.js                # Kết nối SQL: bảng Users
│   │       │   └── redis.js             # Kết nối Redis: lưu OTP/session
│   │       ├── index.js                 # Entry point Auth Service
│   │       ├── controllers/             # Controller xử lý request HTTP
│   │       │   └── auth.controller.js   # Xử lý register, login, logout
│   │       ├── services/                # Logic nghiệp vụ tách riêng
│   │       │   └── auth.service.js      # Hash pwd, issue JWT, OTP flow, sessions
│   │       ├── models/                  # Lớp truy xuất dữ liệu / ORM wrappers
│   │       │   └── user.model.js        # Wrapper model User (DB queries)
│   │       ├── routes/                  # Định nghĩa API endpoints
│   │       │   └── auth.route.js        # /login, /register, /otp
│   │       ├── middlewares/             # Middlewares riêng service
│   │       │   └── jwt.middleware.js    # Xác thực/verify token cho routes
│   │       └── utils/                   # Hàm tiện ích cho Auth
│   │           └── otp.util.js          # Sinh & kiểm tra OTP, rate-limit
│   │
│   ├── user-service/                    # User profile service (profile, bookings, wallet)
│   │   ├── Dockerfile                   # Dockerfile User Service
│   │   ├── package.json                 # Dependencies cho User Service
│   │   ├── .env.example                 # Biến môi trường mẫu (DB)
│   │   └── src/                         # Mã nguồn User Service
│   │       ├── config/                  # Cấu hình DB
│   │       │   └── db.js                # Kết nối SQL cho profile & wallets
│   │       ├── index.js                 # Entry point User Service
│   │       ├── controllers/             # HTTP controllers cho user
│   │       │   └── user.controller.js   # CRUD profile, lấy dữ liệu người dùng
│   │       ├── services/                # Business logic cho user
│   │       │   └── user.service.js      # Tách logic gọi model
│   │       ├── models/                  # Data access layer
│   │       │   └── user.sql.js          # Truy xuất DB (SQL) cho user, wallets
│   │       ├── routes/                  # Định nghĩa endpoint user
│   │       │   └── user.route.js        # Định tuyến REST cho user
│   │       ├── validators/              # Validate input request
│   │       │   └── user.validator.js    # Joi/Zod rules
│   │       └── utils/                   # Helpers
│   │           └── pagination.js        # Hàm phân trang, limit/offset
│   │
│   ├── restaurant-service/                 # Restaurant: metadata + tables + menu + reviews (KHÔNG xử lý booking rules)
│   │   ├── Dockerfile                      # (nên có) Build image restaurant-service
│   │   ├── package.json                    # Dependency + scripts
│   │   ├── .env.example                    # Mẫu env: SQL + Mongo + Redis
│   │   └── src/
│   │       ├── index.js                    # Bootstrap app + mount restaurant routes
│   │       ├── config/
│   │       │   ├── sql.js                  # Kết nối SQL (Restaurants/Tables)
│   │       │   ├── mongo.js                # Kết nối Mongo (MenuItem/Review)
│   │       │   └── redis.js                # Redis (cache read-only như restaurants trending, geo cache...)
│   │       ├── middlewares/
│   │       │   ├── jwt.middleware.js       # Verify JWT cho owner/admin actions
│   │       │   ├── rateLimit.middleware.js # Rate-limit các endpoint public/search
│   │       │   └── requireRole.middleware.js# RBAC: owner/admin
│   │       ├── validators/
│   │       │   ├── restaurant.validator.js # Validate restaurant CRUD/deposit policy payload
│   │       │   ├── menu.validator.js       # Validate menu CRUD payload
|   |       |   ├── review.validator.js     # Validate review CRUD payload
│   │       │   └── common.validator.js     # Các validate dùng chung trong service
│   │       ├── models/
│   │       │   ├── restaurant.sql.js        # Raw SQL: Restaurants (metadata, deposit policy, search fields)
│   │       │   ├── table.sql.js             # Raw SQL: Tables (layout/capacity/status)
│   │       │   ├── menuItem.mongo.js        # Mongoose model: MenuItem
│   │       │   └── review.mongo.js          # Mongoose model: Review
│   │       ├── services/
│   │       │   ├── restaurant.service.js    # Search/detail restaurant, owner CRUD, cache read models
│   │       │   ├── menu.service.js          # Menu CRUD (Mongo)
│   │       │   └── review.service.js        # Review CRUD/query (Mongo)
│   │       │   └── table.service.js         # Table CRUD (SQL)
│   │       ├── controllers/
│   │       │   ├── restaurant.controller.js # /restaurants: list/detail/create/update/delete
│   │       │   ├── menu.controller.js       # /restaurants/:id/menu CRUD
│   │       │   └── review.controller.js     # /restaurants/:id/reviews
│   │       │   └── table.controller.js      # /restaurants/:id/tables CRUD
│   │       ├── routes/
│   │       │   └── restaurant.route.js      # Routes restaurant/menu/review (+ proxy endpoints nếu cần)
│   │       └── utils/
│   │           ├── slug.js                  # Generate slug cho restaurant name
│   │           ├── pagination.js            # Pagination helper (nếu cần, hoặc chuyển sang packages/common)
│   │           └── geo.js                   # Geo helpers (distance/haversine)
│   │
│   ├── booking-service/                    # Booking: booking lifecycle + availability + lock + realtime
│   │   ├── Dockerfile                      # Build image booking-service
│   │   ├── package.json                    # Dependency + scripts (mssql, redis, bull/socket.io...)
│   │   ├── .env.example                    # Mẫu env: SQL, Redis, policy cache, lock TTL...
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js                   # Kết nối SQL (Bookings)
│   │       │   └── redis.js                # Redis: distributed lock + availability cache
│   │       ├── index.js                    # Bootstrap app + routes + socket init (nếu có)
│   │       ├── controllers/
│   │       │   └── booking.controller.js   # HTTP handlers: create/cancel/confirm/check-in/complete...
│   │       ├── services/
│   │       │   ├── booking.service.js      # Core booking rules + transaction + status transitions
│   │       │   └── availability.service.js # ✅ Tính availability + cache + invalidation theo booking changes
│   │       ├── models/
│   │       │   └── booking.sql.js          # Raw SQL: insert/update/select bookings + indexes usage
│   │       ├── routes/
│   │       │   └── booking.route.js        # /api/v1/bookings/*
│   │       ├── middlewares/
│   │       │   ├── jwt.middleware.js           # Verify JWT
│   │       │   ├── optionalAuth.middleware.js  # Xác thực tùy chọn
│   │       │   └── requireRole.middleware.js   # RBAC: owner/admin/customer
│   │       |
|   │       ├── jobs/
│   │       │   └── bookingExpire.job.js    # Auto-expire/no-show cleanup + enqueue notifications
│   │       ├── sockets/
│   │       │   └── booking.socket.js       # Broadcast changes: availability/check-in updates
│   │       └── utils/
│   │           └── lock.redis.js           # Redis lock helper (NX + EX) chống double-booking
|   |           └── time.js                 # Format và đồng bộ thời gian cho slot đặt bàn
│   │
│   ├── payment-service/                    # Thanh toán: deposit/hoa hồng + giao dịch ví + xử lý webhook nhà cung cấp
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js                   # Kết nối SQL Server (Wallets, Transactions). Xuất `getPool()` và `sql`.
│   │       │   └── redis.js                # Redis client (locks, queue webhook, idempotency keys)
│   │       ├── controllers/
│   │       │   ├── payment.controller.js   # Các endpoint công khai liên quan thanh toán (tạo QR, tạo yêu cầu thanh toán)
│   │       │   └── webhook.controller.js   # Webhook endpoints của provider (VNPay, Momo...)
│   │       ├── services/
│   │       │   ├── payment.service.js      # Logic thanh toán chính: tạo yêu cầu thanh toán, build payload
│   │       │   ├── deposit.service.js      # Điều phối deposit cho booking (tạo giao dịch pending, liên kết booking)
│   │       │   ├── wallet.service.js       # Vận hành ví: nạp (top-up), rút (withdraw), quản lý transactions
│   │       │   └── webhook.service.js      # Xử lý webhook idempotent -> cập nhật transactions/ví
│   │       ├── providers/
│   │       │   ├── momo.provider.js        # Adapter Momo: tạo request, verify callback
│   │       │   └── vnpay.provider.js       # Adapter VNPay: sinh URL/QR, verify signature
│   │       ├── models/
│   │       │   └── payment.sql.js          # Hàm SQL thô cho Transactions/Wallets/ liên kết Booking
│   │       ├── routes/
│   │       │   ├── payment.route.js        # Gắn các controller payment (deposit, truy vấn giao dịch)
│   │       │   └── webhook.route.js        # Webhook public cho các provider
│   │       ├── validators/
│   │       │   └── payment.validator.js    # Joi/Zod schemas cho yêu cầu thanh toán và webhook
│   │       ├── middlewares/
│   │       │   ├── jwt.middleware.js       # Hàm hỗ trợ JWT (cho endpoint nội bộ)
│   │       │   ├── validate.middleware.js  # Middleware kiểm tra request (validation)
│   │       │   └── error.middleware.js     # Xử lý lỗi tập trung (centralized error handler)
│   │       ├── utils/
│   │       │   ├── idempotency.js         # Hàm idempotency (Redis) cho webhook
│   │       │   ├── signature.js            # Hàm verify chữ ký của provider
│   │       │   ├── money.js                # Hàm xử lý tiền tệ (đổi sang đơn vị nhỏ, làm tròn)
│   │       │   └── reference-code.js       # Sinh mã tham chiếu thân thiện người dùng
│   │       └── index.js                    # Entry process: khởi động server và workers
│   │
├── promotion-service/              # Promotion microservice
|   │   ├── Dockerfile              # Image build for promotion-service
|   │   ├── package.json            # Dependencies and npm scripts
|   │   ├── .env.example            # Example environment variables
|   │   └── src/                    # Source code
|   │       ├── index.js            # Express app entrypoint, mount routes, health
|   │       ├── config/             # Configuration (DB, Redis, etc.)
|   │       │   └── db.js           # `mssql` pool helper and connection config
|   │       ├── controllers/        # HTTP handlers (thin, call services)
|   │       │   └── promotion.controller.js  # validate/apply/CRUD endpoints
|   │       ├── services/           # Business logic, rule enforcement
|   │       │   └── promotion.service.js     # Validate/apply/usage logic
|   │       ├── models/             # Data access layer (raw SQL)
|   │       │   └── promotion.sql.js         # Queries, transactions, helpers
|   │       ├── routes/             # Express route definitions
|   │       │   └── promotion.route.js       # Route mapping + auth middleware
|   │       ├── validators/         # Input validation schemas
|   │       │   └── promotion.validator.js   # Joi / Zod schemas
|   │       └── utils/              # Small helpers/utilities
|   │           └── promotion-calculator.js  # Discount calculation helpers
│   ├── notification-service/               # Notification worker: SMS/Email/Push (async jobs)
│   │   ├── Dockerfile                      # Build image notification worker
│   │   ├── package.json                    # Dependency senders + queue client
│   │   ├── .env.example                    # Redis + API keys (SendGrid/Twilio...)
│   │   └── src/
│   │       ├── config/
│   │       │   └── redis.js                # Redis connection (Bull/queue)
│   │       ├── index.js                    # Worker entrypoint: subscribe queue + process jobs
│   │       ├── services/
│   │       │   ├── sms.service.js          # Provider adapter: Twilio/SMSAPI...
│   │       │   └── email.service.js        # Provider adapter: SendGrid/Nodemailer...
│   │       └── queues/
│   │           └── notification.queue.js   # Queue definitions: job names, retries, backoff...
│   │
│   └── admin-service/                      # Admin: moderation + stats + approval flows
│       ├── Dockerfile                      # Build image admin-service
│       ├── package.json                    # Dependency admin
│       ├── .env.example                    # Env: SQL + Mongo (analytics/logs) + auth
│       └── src/
│           ├── config/
│           │   ├── sql.js                  # SQL connection (admin queries)
│           │   └── mongo.js                # Mongo connection (analytics/logs)
│           ├── index.js                    # Bootstrap admin service
│           ├── controllers/
│           │   └── admin.controller.js     # HTTP handlers cho admin actions
│           ├── services/
│           │   └── admin.service.js        # Business logic admin (approve/suspend/reporting)
│           └── routes/
│               └── admin.route.js          # /api/v1/admin/*
│
├── packages/                               # Shared libs giữa các services
│   ├── common/
│   │   ├── package.json                    # Dependency common (logger/errors/redis client...)
│   │   └── src/
│   │       ├── logger.js                   # Winston/Morgan config chuẩn (dùng lại)
│   │       ├── errors.js                   # Standard error classes + mapping HTTP codes
│   │       └── redis.client.js             # Redis wrapper dùng chung (singleton, reconnect policy)
│   └── types/
│       ├── package.json                    # Shared types package
│       └── src/
│           └── api-types.js                # DTO/interfaces shared (nếu dùng TS càng hữu ích)
│
├── infra/
│   ├── docker-compose.yml                  # Dev orchestration: SQL/Mongo/Redis + services
│   ├── k8s/
│   │   ├── deployment.yaml                 # Kubernetes deployments
│   │   └── service.yaml                    # Kubernetes services
│   └── nginx/
│       └── gateway.conf                    # Nginx reverse proxy/load balancing rules
│
├── scripts/
│   ├── build-all.ps1                       # Build tất cả services (Windows)
│   └── deploy-all.ps1                      # Deploy tất cả (Windows)
│
├── terraform/
│   └── main.tf                             # IaC (nếu dùng AWS/GCP/Azure)
│
└── README.md                               # Tổng quan dự án + cách chạy local + conventions

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

-- BOOKINGS
CREATE TABLE dbo.Bookings (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  bookingCode NVARCHAR(30) UNIQUE NOT NULL, -- BK20250206XXXX
  
  -- Authenticated user (nullable)
  customerId UNIQUEIDENTIFIER NULL,

  -- Guest info (required if customerId is NULL)
  guestName NVARCHAR(100) NULL,
  guestPhone NVARCHAR(20) NULL,
  guestEmail NVARCHAR(100) NULL,
  
  restaurantId UNIQUEIDENTIFIER NOT NULL,
  tableId UNIQUEIDENTIFIER NULL,
  bookingDate DATE NOT NULL,
  bookingTime NVARCHAR(10) NOT NULL, -- "18:30"
  numGuests INT NOT NULL CHECK (numGuests > 0),
  specialRequests NVARCHAR(MAX),
  
  status NVARCHAR(30) NOT NULL CHECK (status IN (
    'PENDING',        -- Chờ thanh toán deposit
    'CONFIRMED',      -- Đã xác nhận
    'ARRIVED',        -- Khách đã đến
    'COMPLETED',      -- Hoàn thành
    'CANCELLED',      -- Đã hủy
    'NO_SHOW'         -- Không đến
  )),
  
  depositRequired BIT DEFAULT 0,
  depositAmount FLOAT,
  depositPaidAt DATETIME2,
  
  commissionFee FLOAT, -- Platform commission
  
  cancelledBy NVARCHAR(20), -- "customer", "restaurant", "admin"
  cancelledAt DATETIME2,
  cancellationReason NVARCHAR(500),
  
  createdAt DATETIME2 DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
  
  FOREIGN KEY (customerId) REFERENCES dbo.Users(id),
  FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  
  -- Constraint: Must have either customerId OR guest contact info
  CONSTRAINT CK_Booking_Customer_Or_Guest 
    CHECK (customerId IS NOT NULL OR guestPhone IS NOT NULL)
);

CREATE INDEX IX_Bookings_CustomerId ON dbo.Bookings(customerId);
CREATE INDEX IX_Bookings_RestaurantId ON dbo.Bookings(restaurantId);
CREATE INDEX IX_Bookings_BookingDate ON dbo.Bookings(bookingDate);
CREATE INDEX IX_Bookings_Status ON dbo.Bookings(status);
CREATE INDEX IX_Bookings_Code ON dbo.Bookings(bookingCode);

-- Indexes for guest lookup
CREATE INDEX IX_Bookings_GuestPhone ON dbo.Bookings(guestPhone) 
  WHERE guestPhone IS NOT NULL;
CREATE INDEX IX_Bookings_GuestEmail ON dbo.Bookings(guestEmail) 
  WHERE guestEmail IS NOT NULL;

-- WALLETS (mỗi user/restaurant có tối đa 1 wallet)
CREATE TABLE dbo.Wallets (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    userId UNIQUEIDENTIFIER NULL,
    restaurantId UNIQUEIDENTIFIER NULL,

    balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    lockedAmount DECIMAL(18,2) NOT NULL DEFAULT 0,

    currency NVARCHAR(10) NOT NULL DEFAULT 'VND',
    status NVARCHAR(20) NOT NULL DEFAULT 'active',

    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Wallets PRIMARY KEY (id),

    CONSTRAINT CK_Wallets_Owner
    CHECK (
        (userId IS NOT NULL AND restaurantId IS NULL)
        OR
        (userId IS NULL AND restaurantId IS NOT NULL)
    ),

    CONSTRAINT CK_Wallets_Status
    CHECK (status IN ('active', 'locked', 'closed')),

    CONSTRAINT CK_Wallets_Currency
    CHECK (currency IN ('VND', 'USD', 'GBP')),

    CONSTRAINT FK_Wallets_User
    FOREIGN KEY (userId) REFERENCES dbo.Users(id),

    CONSTRAINT FK_Wallets_Restaurant
    FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id)
);
GO

-- Index cho Wallets
CREATE UNIQUE INDEX UQ_Wallets_UserId
ON dbo.Wallets(userId)
WHERE userId IS NOT NULL;
GO

CREATE UNIQUE INDEX UQ_Wallets_RestaurantId
ON dbo.Wallets(restaurantId)
WHERE restaurantId IS NOT NULL;
GO

-- TRANSACTIONS
CREATE TABLE dbo.Transactions (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),

    walletId UNIQUEIDENTIFIER NULL,
    bookingId UNIQUEIDENTIFIER NULL,

    type NVARCHAR(30) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    currency NVARCHAR(10) NOT NULL DEFAULT 'VND',

    balanceBefore DECIMAL(18,2) NULL,
    balanceAfter DECIMAL(18,2) NULL,

    description NVARCHAR(MAX) NULL,
    paymentMethod NVARCHAR(50) NULL,

    referenceCode NVARCHAR(100) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending',

    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    payerType NVARCHAR(30) NULL,
    provider NVARCHAR(30) NULL,
    providerTxnId NVARCHAR(100) NULL,
    idempotencyKey NVARCHAR(100) NULL,
    metadataJson NVARCHAR(MAX) NULL,

    completedAt DATETIME2 NULL,
    failedAt DATETIME2 NULL,

    CONSTRAINT PK_Transactions PRIMARY KEY (id),

    CONSTRAINT CK_Transactions_Type
    CHECK (type IN (
        'DEPOSIT_PAYMENT',
        'TOP_UP',
        'COMMISSION',
        'REFUND',
        'WITHDRAWAL',
        'SETTLEMENT'
    )),

    CONSTRAINT CK_Transactions_Status
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),

    CONSTRAINT CK_Transactions_Amount
    CHECK (amount > 0),

    CONSTRAINT CK_Transactions_Currency
    CHECK (currency IN ('VND', 'USD', 'GBP')),

    CONSTRAINT CK_Transactions_PayerType
    CHECK (
        payerType IS NULL OR payerType IN (
            'CUSTOMER_USER',
            'CUSTOMER_GUEST',
            'RESTAURANT',
            'ADMIN'
        )
    ),

    CONSTRAINT CK_Transactions_Provider
    CHECK (
        provider IS NULL OR provider IN ('MOMO', 'VNPAY', 'INTERNAL')
    ),

    CONSTRAINT FK_Transactions_Wallet
    FOREIGN KEY (walletId) REFERENCES dbo.Wallets(id),

    CONSTRAINT FK_Transactions_Booking
    FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id)
);
GO
-- Index cho Transactions
CREATE INDEX IX_Transactions_BookingId
ON dbo.Transactions(bookingId);
GO

CREATE INDEX IX_Transactions_ProviderTxnId
ON dbo.Transactions(providerTxnId);
GO

CREATE INDEX IX_Transactions_walletId
ON dbo.Transactions(walletId);
GO

CREATE INDEX IX_Transactions_Status
ON dbo.Transactions(status);
GO

CREATE UNIQUE INDEX UQ_Transactions_ReferenceCode
ON dbo.Transactions(referenceCode)
WHERE referenceCode IS NOT NULL;
GO

CREATE INDEX IX_Transactions_BookingId_Type_Status
ON dbo.Transactions(bookingId, type, status);
GO

-- Indexes (khuyến nghị)
CREATE INDEX IX_Restaurants_ownerId ON dbo.Restaurants(ownerId);
CREATE INDEX IX_Tables_restaurantId ON dbo.Tables(restaurantId);
CREATE INDEX IX_Bookings_customerId ON dbo.Bookings(customerId);
CREATE INDEX IX_Bookings_restaurantId ON dbo.Bookings(restaurantId);
CREATE INDEX IX_Bookings_slot ON dbo.Bookings(restaurantId, bookingDate, bookingTime);
CREATE INDEX IX_Transactions_walletId ON dbo.Transactions(walletId);
CREATE INDEX IX_Transactions_bookingId ON dbo.Transactions(bookingId);


-- PROMOTIONS
CREATE TABLE dbo.Promotions (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  restaurantId UNIQUEIDENTIFIER NOT NULL,
  name NVARCHAR(150) NOT NULL,
  code NVARCHAR(50) NOT NULL,
  type NVARCHAR(30) NOT NULL,
  value FLOAT NULL,
  maxDiscount FLOAT NULL,
  minBookingAmount FLOAT NULL,
  minGuests INT NULL,
  applicableDays NVARCHAR(50) NULL,
  applicableTimeSlots NVARCHAR(MAX) NULL,
  usageLimit INT NULL,
  usageCount INT NOT NULL DEFAULT 0,
  perUserLimit INT NULL,
  startDate DATE NULL,
  endDate DATE NULL,
  isActive BIT NOT NULL DEFAULT 1,
  status NVARCHAR(30) NOT NULL DEFAULT 'active',
  createdAt DATETIME2 DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Promotions_code UNIQUE (code),
  CONSTRAINT FK_Promotions_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id)
);

CREATE TABLE dbo.PromotionUsages (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  promotionId UNIQUEIDENTIFIER NOT NULL,
  customerId UNIQUEIDENTIFIER NULL,
  bookingId UNIQUEIDENTIFIER NOT NULL,
  discountAmount FLOAT,
  usedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PromotionUsages_promotion FOREIGN KEY (promotionId) REFERENCES dbo.Promotions(id),
  CONSTRAINT UQ_PromotionUsages_booking UNIQUE (bookingId)
);

CREATE INDEX IX_Promotions_restaurant_active ON dbo.Promotions(restaurantId, isActive, status);
CREATE INDEX IX_PromotionUsages_promotion_customer ON dbo.PromotionUsages(promotionId, customerId);
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
1. Public endpoint
POST   /api/v1/bookings
GET    /api/v1/bookings/guest/lookup
2. Authenticated endpoint
GET    /api/v1/bookings/:id
GET    /api/v1/bookings/my-bookings
PUT    /api/v1/bookings/:id/cancel
PUT    /api/v1/bookings/:id/confirm
3. Restaurant Owner endpoint
GET    /api/v1/restaurants/:id/bookings
PUT   /api/v1/bookings/:id/check-in
PUT   /api/v1/bookings/:id/complete
PUT   /api/v1/bookings/:id/no-show
PUT   /api/v1/bookings/:id/restaurant-cancel

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

### 4.7 Promotions
```javascript
GET    /api/v1/promotions/available?restaurantId=
GET    /api/v1/promotions/:code
POST   /api/v1/promotions/validate
POST   /api/v1/promotions/apply
POST   /api/v1/promotions           # owner/admin create
PUT    /api/v1/promotions/:id       # update
DELETE /api/v1/promotions/:id       # delete
GET    /api/v1/promotions/:id/stats # usage/stats
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

### 5.5 Promotion Service examples

- Validate (controller → service):
```js
// services/promotion.controller.js
const { validatePromotion } = require('../services/promotion.service');
async function validate(req, res) {
  const payload = req.body;
  const result = await validatePromotion(payload);
  return res.json({ success: result.valid, data: result });
}
```

- Apply (service -> SQL transaction):
```js
// services/promotion.service.js
const { sql, getPool } = require('../config/db');
async function applyPromotion({ code, bookingId, customerId }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    // select promotion with UPDLOCK to increment usageCount safely
    // insert into dbo.PromotionUsages
    // update dbo.Promotions set usageCount = usageCount + 1
    await tx.commit();
    return { applied: true };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}
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
