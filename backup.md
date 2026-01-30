
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
my-microservices-app/                     # Thư mục gốc của dự án
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
│   ├── restaurant-service/              # Restaurant service (metadata, menu)
│   │   ├── Dockerfile                   # Dockerfile Restaurant Service
│   │   ├── package.json                 # Dependencies cho Restaurant Service
│   │   ├── .env.example                 # Biến môi trường mẫu (SQL, MONGO)
│   │   └── src/                         # Mã nguồn Restaurant Service
│   │       ├── config/                  # Kết nối DB (SQL + Mongo)
│   │       │   ├── sql.js               # Kết nối SQL: nhà hàng, tables
│   │       │   └── mongo.js             # Kết nối MongoDB: menu, reviews
│   │       ├── index.js                 # Entry point
│   │       ├── controllers/             # Controllers cho restaurant
│   │       │   └── restaurant.controller.js # Tìm kiếm, lấy chi tiết nhà hàng
│   │       ├── services/                # Business logic nhà hàng + menu
│   │       │   ├── restaurant.service.js
│   │       │   └── menu.service.js      # Quản lý menu (schema động trên Mongo)
│   │       ├── models/                  # ORM / schemas
│   │       │   ├── restaurant.sql.js    # SQL model: Restaurant, Table
│   │       │   └── menu.mongo.js        # Mongoose schema: MenuItem, Review
│   │       ├── routes/                  # API routes restaurant
│   │       │   └── restaurant.route.js  # /restaurants, /menu endpoints
│   │       ├── middlewares/             # Middlewares like rate limiting
│   │       │   └── rateLimit.middleware.js
│   │       └── utils/                   # Utils specific to restaurant
│   │           └── availability.js      # Tính toán bàn trống, truy xuất cache
│   │
│   ├── booking-service/                 # Booking service (locks, cron jobs)
│   │   ├── Dockerfile                   # Dockerfile Booking Service
│   │   ├── package.json                 # Dependencies: bull, redis, mssql
│   │   ├── .env.example                 # Biến môi trường mẫu (DB, REDIS)
│   │   └── src/                         # Mã nguồn Booking Service
│   │       ├── config/                  # DB & Redis config
│   │       │   ├── db.js                # Kết nối SQL: lưu Bookings
│   │       │   └── redis.js             # Kết nối Redis: distributed lock
│   │       ├── index.js                 # Entry point
│   │       ├── controllers/             # HTTP controllers booking
│   │       │   └── booking.controller.js# Tạo/hủy/xác nhận booking
│   │       ├── services/                # Business logic booking
│   │       │   └── booking.service.js   # Tạo booking, xử lý transaction
│   │       ├── models/                  # Data access booking
│   │       │   └── booking.sql.js       # SQL queries cho Bookings
│   │       ├── routes/                  # API routes booking
│   │       │   └── booking.route.js
│   │       ├── jobs/                    # Cron/job consumer
│   │       │   └── bookingExpire.job.js # Hủy booking quá hạn, notifications
│   │       ├── sockets/                 # Real-time socket handlers
│   │       │   └── booking.socket.js    # Broadcast availability/check-in
│   │       └── utils/                   # Helper utilities
│   │           └── lock.redis.js        # Helper distributed lock using Redis
│   │
│   ├── payment-service/                 # Payment & wallet service
│   │   ├── Dockerfile                   # Dockerfile Payment Service
│   │   ├── package.json                 # Dependencies thanh toán
│   │   ├── .env.example                 # Biến môi trường (VNPAY, MOMO keys)
│   │   └── src/                         # Mã nguồn Payment Service
│   │       ├── config/                  # DB config for transactions/wallet
│   │       │   └── db.js                # Kết nối SQL cho Transaction & Wallet
│   │       ├── index.js                 # Entry point
│   │       ├── controllers/             # Controller xử lý payment endpoints
│   │       │   └── payment.controller.js# Tạo QR, webhook handler
│   │       ├── services/                # Logic xử lý giao dịch
│   │       │   ├── payment.service.js   # Xử lý webhook, cập nhật transaction
│   │       │   └── qr.service.js        # Tạo mã VietQR / QR buffer
│   │       ├── routes/                  # Payment routes
│   │       │   └── payment.route.js
│   │       └── utils/                   # Helpers
│   │           └── webhook.validator.js # Xác thực chữ ký từ cổng thanh toán
│   │
│   ├── notification-service/            # Notification worker (SMS/Email/Push)
│   │   ├── Dockerfile                   # Dockerfile Notification Service
│   │   ├── package.json                 # Dependencies Noti service
│   │   ├── .env.example                 # Biến môi trường (REDIS, API keys)
│   │   └── src/                         # Mã nguồn Notification
│   │       ├── config/                  # Redis config cho queue
│   │       │   └── redis.js             # Kết nối redis cho queue
│   │       ├── index.js                 # Worker entry point xử lý queue
│   │       ├── services/                # SMS/Email sender services
│   │       │   ├── sms.service.js       # Gửi SMS (Twilio/SpeedSMS)
│   │       │   └── email.service.js     # Gửi Email (SendGrid/Nodemailer)
│   │       └── queues/                  # Định nghĩa consumer/producer
│   │           └── notification.queue.js# Consumer xử lý job gửi tin
│   │
│   └── admin-service/                   # Admin tools (moderation, stats)
│       ├── Dockerfile                   # Dockerfile Admin Service
│       ├── package.json                 # Dependencies admin
│       ├── .env.example                 # Biến môi trường admin
│       └── src/                         # Mã nguồn Admin
       ├── config/                  # DB config cho admin
       │   ├── sql.js               # Kết nối SQL quản trị
       │   └── mongo.js             # Kết nối MongoDB (logs, analytics)
       ├── index.js                 # Entry point admin
       ├── controllers/             # Admin controllers
       │   └── admin.controller.js  # Duyệt, khóa, quản lý
       ├── services/                # Logic admin
       │   └── admin.service.js
       └── routes/                  # Admin API routes
         └── admin.route.js       # /admin/* endpoints
│
├── packages/                            # Shared packages/libs giữa services
│   ├── common/                          # Thư viện dùng chung (logger, errors)
│   │   ├── package.json                 # Khai báo dependency common
│   │   └── src/
│   │       ├── logger.js                # Cấu hình Winston/Morgan dùng chung
│   │       ├── errors.js                # Lớp lỗi chuẩn (BadRequestError,...)
│   │       └── redis.client.js          # Wrapper kết nối Redis dùng chung
│   └── types/                           # Định nghĩa kiểu/chung cho TS/JS
│       ├── package.json                 # Dependencies type definitions
│       └── src/
│           └── api-types.js             # Shared interfaces/types
|
├── infra/                               # Cấu hình hạ tầng & triển khai
│   ├── docker-compose.yml               # Orchestration cho môi trường dev
│   ├── k8s/                             # Các manifest Kubernetes
│   │   ├── deployment.yaml              # K8s Deployment configs
│   │   └── service.yaml                 # K8s Service configs
│   └── nginx/                           # Cấu hình reverse-proxy nếu cần
│       └── gateway.conf                 # Cấu hình Nginx Load Balancer
|
├── scripts/                             # Scripts tiện ích build/deploy
│   ├── build-all.ps1                    # Script build toàn bộ service (Windows PS)
│   └── deploy-all.ps1                   # Script deploy lên server/k8s
|
├── terraform/                           # (Nếu dùng) IaC cho cloud
│   └── main.tf                          # Cấu hình hạ tầng (AWS/GCP/...)
|
└── README.md                            # Hướng dẫn dự án
```