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
> Có thể triển khai bằng **JavaScript hoặc TypeScript** (một số ví dụ đang dùng `.ts`), giữ Express làm framework chính.

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

#### Phân chia trách nhiệm dữ liệu
- **SQL Server**: Users, Restaurants, Tables, Bookings, Wallets, Transactions (quan hệ chặt chẽ, cần transaction)
- **MongoDB**: Reviews, Menu Items, Analytics Events (schema linh hoạt, dễ mở rộng)
- **Redis**: Sessions, OTP, Rate limiting, distributed lock, cache truy vấn, realtime availability

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

### 3.1 SQL Server (Prisma Schema)
```prisma
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
  priceRange      Int
  ratingAvg       Float    @default(0)
  ratingCount     Int      @default(0)

  description     String?
  images          String[]
  openingHours    Json

  depositEnabled  Boolean  @default(false)
  depositPolicy   Json?

  commissionRate  Float    @default(10)
  status          String   @default("pending")
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
  type         String     @default("normal")
  location     String?
  status       String     @default("available")

  bookings     Booking[]
}

model Booking {
  id              String        @id @default(uuid())
  bookingCode     String        @unique

  customerId      String
  customer        User          @relation(fields: [customerId], references: [id])
  restaurantId    String
  restaurant      Restaurant    @relation(fields: [restaurantId], references: [id])
  tableId         String?
  table           Table?        @relation(fields: [tableId], references: [id])

  bookingDate     DateTime
  bookingTime     String
  numGuests       Int

  status          BookingStatus @default(PENDING)
  notes           String?

  depositRequired Boolean       @default(false)
  depositAmount   Float?
  depositPaid     Boolean       @default(false)
  depositPaidAt   DateTime?
  depositRefunded Boolean       @default(false)

  commissionFee   Float?
  commissionPaid  Boolean       @default(false)

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
  lockedAmount Float    @default(0)

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
  paymentMethod   String?
  referenceCode   String?

  status          String          @default("pending")

  createdAt       DateTime        @default(now())
}
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

#### Google Sign-in (Firebase) notes
- Client lấy `idToken` từ Firebase Client SDK qua `user.getIdToken()`.
- Client POST `{ "idToken": "<ID_TOKEN>" }` tới `POST /api/v1/auth/google-signin`.
- Backend verify `idToken` bằng `firebase-admin`, tạo user nếu chưa tồn tại, rồi phát hành app JWT.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: khuyến nghị lưu JSON service account dạng base64 trong env.

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
GET    /api/v1/restaurants
GET    /api/v1/restaurants/:id
GET    /api/v1/restaurants/:id/menu
GET    /api/v1/restaurants/:id/reviews
GET    /api/v1/restaurants/:id/availability

// Restaurant owner
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

// Restaurant confirms
PUT    /api/v1/bookings/:id/confirm
PUT    /api/v1/bookings/:id/reject
```

### 4.5 Payment
```javascript
POST   /api/v1/payment/deposit/generate-qr
POST   /api/v1/payment/webhook/vnpay
POST   /api/v1/payment/webhook/momo
GET    /api/v1/payment/transaction/:id

// Wallet
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

## 5) CORE SERVICES IMPLEMENTATION

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

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { wallet: true }
    });

    if (!restaurant) throw new Error('Restaurant not found');

    let depositRequired = false;
    let depositAmount = 0;

    if (restaurant.depositEnabled && restaurant.depositPolicy) {
      const policy = restaurant.depositPolicy as any;

      if (numGuests >= policy.minGuests) {
        depositRequired = true;
        depositAmount = policy.type === 'per_person'
          ? policy.amount * numGuests
          : policy.amount;
      }
    }

    const lockKey = `booking:lock:${restaurantId}:${bookingDate}:${bookingTime}`;
    const locked = await redis.set(lockKey, 'locked', 'EX', 60, 'NX');

    if (!locked) {
      throw new Error('This time slot is being booked by someone else');
    }

    const bookingCode = this.generateBookingCode();

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

    await redis.del(lockKey);

    return { booking, depositRequired, depositAmount };
  }

  private generateBookingCode(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BK${dateStr}${random}`;
  }

  async processDepositPayment(bookingId: string, transactionRef: string) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: { depositPaid: true, depositPaidAt: new Date(), status: 'CONFIRMED' },
        include: { restaurant: true }
      });

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

      // TODO: trigger notification (SMS/Email)
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
      const wallet = await tx.wallet.findUnique({ where: { restaurantId } });
      if (!wallet) throw new Error('Wallet not found');

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });

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

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter }
      });

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

      await tx.booking.update({
        where: { id: bookingId },
        data: { commissionPaid: true }
      });
    });
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
