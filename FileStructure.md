```
SeatNow/                                    # Root monorepo: chứa toàn bộ services + packages + infra
├── services/                               # Mỗi service là một bounded-context (microservice)
│   ├── api-gateway/                        # Gateway: entrypoint của client, proxy/route tới services
│   │   ├── Dockerfile                      # Build image cho gateway
│   │   ├── package.json                    # Dependency + scripts của gateway
│   │   ├── .env.example                    # Mẫu env: URLs services, redis, auth options...
│   │   └── src/
│   │       ├── config/
│   │       │   └── redis.js                # Redis cho rate-limit/cache trên gateway
│   │       ├── index.js                    # Bootstrap express + mount proxy routes
│   │       ├── routes/
│   │       │   └── proxy.routes.js         # Map /api/v1/* -> service tương ứng (routing table)
│   │       ├── middlewares/
│   │       │   ├── logging.middleware.js   # Log request/response (morgan/winston)
│   │       │   └── auth-proxy.middleware.js# Decode JWT nhẹ để route/forward đúng header
│   │       └── utils/
│   │           └── service-discovery.js    # Resolve service name -> URL (env / config)
│   │
│   ├── auth-service/                       # Auth: đăng ký/đăng nhập/OTP/refresh token
│   │   ├── Dockerfile                      # Build image auth-service
│   │   ├── package.json                    # Dependency + scripts
│   │   ├── .env.example                    # Mẫu env: SQL, Redis, JWT secrets, OTP settings...
│   │   └── src/
│   │       ├── config/
│   │       │   ├── db.js                   # Kết nối SQL (Users)
│   │       │   └── redis.js                # Redis cho OTP/session/rate-limit auth
│   │       ├── index.js                    # Bootstrap app + mount routes
│   │       ├── controllers/
│   │       │   └── auth.controller.js      # HTTP handlers: login/register/otp/refresh/logout
│   │       ├── services/
│   │       │   └── auth.service.js         # Business logic: hash/verify pwd, issue JWT, OTP flow
│   │       ├── models/
│   │       │   └── user.model.js           # Data-access: query user (SQL)
│   │       ├── routes/
│   │       │   └── auth.route.js           # Route definitions /api/v1/auth/*
│   │       ├── middlewares/
│   │       │   └── jwt.middleware.js       # Verify JWT (nếu auth-service có endpoint cần auth)
│   │       └── utils/
│   │           └── otp.util.js             # Generate/verify OTP, normalize phone, throttling helpers
│   │
│   ├── user-service/                       # User: profile + wallet view + bookings view của user
│   │   ├── Dockerfile                      # Build image user-service
│   │   ├── package.json                    # Dependency + scripts
│   │   ├── .env.example                    # Mẫu env: SQL connection...
│   │   └── src/
│   │       ├── config/
│   │       │   └── db.js                   # Kết nối SQL (Users/Wallets view)
│   │       ├── index.js                    # Bootstrap app + mount routes
│   │       ├── controllers/
│   │       │   └── user.controller.js      # HTTP handlers: /me, /wallet, /bookings view...
│   │       ├── services/
│   │       │   └── user.service.js         # Business logic user: orchestrate models + validations
│   │       ├── models/
│   │       │   └── user.sql.js             # Raw SQL queries cho user/wallet (read/write theo scope)
│   │       ├── routes/
│   │       │   └── user.route.js           # /api/v1/users/*
│   │       ├── validators/
│   │       │   └── user.validator.js       # Joi/Zod schemas cho payload
│   │       └── utils/
│   │           └── pagination.js           # Helper phân trang (limit/offset)
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
│   │       ├── controllers/
│   │       │   ├── restaurant.controller.js # /restaurants: list/detail/create/update/delete
│   │       │   ├── menu.controller.js       # /restaurants/:id/menu CRUD
│   │       │   └── review.controller.js     # /restaurants/:id/reviews
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
│   │       ├── jobs/
│   │       │   └── bookingExpire.job.js    # Auto-expire/no-show cleanup + enqueue notifications
│   │       ├── sockets/
│   │       │   └── booking.socket.js       # Broadcast changes: availability/check-in updates
│   │       └── utils/
│   │           └── lock.redis.js           # Redis lock helper (NX + EX) chống double-booking
│   │
│   ├── payment-service/                    # Payment: deposit/commission + wallet transactions + webhook
│   │   ├── Dockerfile                      # Build image payment-service
│   │   ├── package.json                    # Dependency cổng thanh toán
│   │   ├── .env.example                    # Keys: vnpay/momo/zalopay + SQL
│   │   └── src/
│   │       ├── config/
│   │       │   └── db.js                   # Kết nối SQL (Wallets/Transactions)
│   │       ├── index.js                    # Bootstrap app
│   │       ├── controllers/
│   │       │   └── payment.controller.js   # Generate QR + webhook handlers + transaction status
│   │       ├── services/
│   │       │   ├── payment.service.js      # Verify signature/webhook -> update transaction atomically
│   │       │   └── qr.service.js           # Generate VietQR/QRCode buffer (helper layer)
│   │       ├── routes/
│   │       │   └── payment.route.js        # /api/v1/payment/*
│   │       └── utils/
│   │           └── webhook.validator.js    # Validate payload + signature rules per provider
│   │
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
