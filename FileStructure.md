
```Javascript

// JavaScript
// Service skeletons (implement details per your stack)

export class AuthService {
  async register(dto) { /* create user, hash pwd, issue token */ }
  async login(dto) { /* verify, issue tokens */ }
  async refreshToken(token) { /* refresh flow */ }
  async sendOtp(phone) { /* store OTP in Redis */ }
  async verifyOtp(phone, code) { /* verify OTP */ }
}

export class UserService {
  async getMe(userId) { /* fetch user profile */ }
  async updateMe(userId, data) { /* update */ }
  async getMyBookings(userId) { /* return bookings */ }
  async getWallet(userId) { /* wallet + transactions */ }
}

export class RestaurantService {
  async create(dto) { /* create + init wallet */ }
  async update(id, dto) { }
  async getById(id) { }
  async search(params) { /* filters, geo, pagination */ }
  async getAvailability(id, date) { /* check Redis/cache */ }
  async updateDepositPolicy(id, policy) { }
}

export class MenuService {
  async addItem(restaurantId, dto) { }
  async updateItem(itemId, dto) { }
  async list(restaurantId) { }
  async toggleAvailability(itemId, available) { }
}

export class BookingService {
  async create(dto) { /* lock Redis, calc deposit, create booking */ }
  async getById(id) { }
  async cancel(id, by) { /* refund logic if needed */ }
  async confirm(id, by) { }
  async checkIn(id) { }
  async complete(id) { /* trigger commission deduction */ }
  async addReview(id, dto) { /* push to Mongo */ }
  async processDepositPayment(bookingId, txRef) { /* existing code */ }
}

export class PaymentService {
  async generateVietQR(data) { /* return QR url / buffer */ }
  async handleWebhook(provider, payload) { /* validate + update booking/wallet */ }
  async createTransaction(walletId, dto) { }
}

export class WalletService {
  async topUp(restaurantId, amount, method) { /* tx + wallet update */ }
  async withdraw(restaurantId, amount, dest) { }
  async deductCommission(bookingId) { /* existing code */ }
  async getTransactions(walletId, filters) { }
}

export class NotificationService {
  async sendSms(phone, text) { /* Twilio/SMS API */ }
  async sendEmail(to, subject, html) { /* SendGrid/Nodemailer */ }
  async sendBookingConfirmation(booking) { }
}

export class QrCodeService {
  async generateVietQR(data) { /* url generation */ }
  async generateQRCodeBuffer(text) { /* qrcode lib */ }
}

export class ReviewService {
  async create(reviewDto) { /* save to Mongo, update restaurant rating */ }
  async listByRestaurant(restaurantId, opts) { }
  async helpful(reviewId, delta = 1) { }
}

export class SearchService {
  async searchRestaurants(params) { /* SQL + geo + filters + caching */ }
  async autocomplete(q) { }
}

export class FileService {
  async uploadImage(file, opts) { /* S3/Cloudinary + Sharp */ }
  async delete(path) { }
}

export class SocketService {
  init(server) { /* socket.io init, namespaces, auth */ }
  emitAvailability(restaurantId, payload) { }
}

export class AdminService {
  async listPendingRestaurants(page) { }
  async approveRestaurant(id, adminId) { }
  async suspendRestaurant(id, reason) { }
  async getStats(range) { }
}

export class AnalyticsService {
  async trackEvent(event) { /* push to Mongo / queue */ }
  async getDashboardStats(range) { }
}

export class CronJobs {
  start() { /* schedule reminders, cleanup, refunds */ }
  async reminderJob() { }
  async cleanupJob() { }
}
```

```
my-microservices-app/
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