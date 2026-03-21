# DANH SÁCH TÍNH NĂNG VÀ HÀM XỬ LÝ TƯƠNG ỨNG (SEATNOW)
Dưới đây là tài liệu tổng hợp những tính năng **ĐÃ HOÀN THIỆN** trong hệ thống SeatNow hiện tại, kèm theo tên Service, Base URL và hàm xử lý (Controller/Service/SQL) chịu trách nhiệm chính.

---

## 🚀 HỆ THỐNG API GATEWAY
- **Base URL:** `http://localhost:7000`
- **Công nghệ:** .NET Ocelot API Gateway
- **Chức năng:** Hợp nhất các microservices, xử lý routing, auth check tập trung.

---

## 1. KHÁCH HÀNG (CUSTOMER)

### 1.1 Tài khoản & Xác thực (`auth_service` - `http://localhost:3001`)
- **Đăng ký tài khoản (Email/Phone):** `auth_controller.register`
- **Đăng nhập / Validate Token:** `auth_controller.login`, `auth_controller.validateToken`
- **Xác thực OTP:** `auth_controller.verifyOtp`
- **Quên mật khẩu (Tự động):** `auth_controller.forgotPasswordCustomer` ➔ Gửi mật khẩu mới qua Email (`email_util.sendNewPasswordEmail`)
- **Xem / Cập nhật Profile (`user_service` - `http://localhost:3002`):** `user_controller.getProfile`, `user_controller.updateProfile`

### 1.2 Tìm kiếm & Khám phá Nhà hàng (`restaurant-service` - `http://localhost:3003`)
- **Tìm kiếm nhà hàng theo bộ lọc (Giá, Cuisine, Keyword):** `restaurant_controller.listRestaurants` ➔ `restaurant_sql.findMany`
- **Tìm kiếm Theo vị trí (Bán kính GPS / Near Me):** `restaurant_controller.listRestaurantsNearMe` ➔ `restaurant_sql.findManyNearMe`

### 1.3 Xem chi tiết Nhà hàng (`restaurant-service` - `http://localhost:3003`)
- **Xem thông tin chi tiết (Giờ mở cửa, mô tả, ảnh):** `restaurant_controller.getRestaurant` ➔ `restaurant_sql.findById`
- **Xem Menu món ăn:** `menu_controller.listByRestaurant` ➔ `menu_mongo.find`
- **Xem Sơ đồ Bàn trống:** `restaurant_controller.checkAvailability` ➔ `booking_service.checkAvailability`
- **Xem Đánh giá (Reviews):** `review_controller.list` ➔ `review_service.listReviews`

### 1.4 Đặt bàn & Thanh toán (`booking-service` - `http://localhost:3004` & `payment-service` - `http://localhost:3005`)
- **Tạo yêu cầu Đặt bàn (Pending):** `booking_controller.createBooking` ➔ `booking_sql.createBooking` (Cơ chế Lock Redis chống Overbooking)
- **Kiểm tra sức chứa của Bàn (Capacity Test):** `booking_service.calculateAvailability`
- **Thanh toán Tiền cọc (Deposit):** `booking_controller.payDeposit` ➔ Gọi proxy qua `payment-service` (`payment_controller.processDeposit`)
- **Khóa tiền trong ví khách hàng (Lock Amount):** `wallet_service.holdDeposit` (Idempotency Key)
- **Tạo Mã QR Code Check-in:** `booking_service.generateBookingQR`

### 1.5 Quản lý Booking (`booking-service` - `http://localhost:3004`)
- **Xem lịch sử đặt bàn:** `booking_controller.getUserBookings`
- **Xem chi tiết Booking:** `booking_controller.getBookingById`
- **Khách hàng tự Hủy Booking:** `booking_controller.cancelBooking` (Tự động hoàn tiền cọc nếu hợp lệ)

### 1.6 Đánh giá & Rating (`restaurant-service` - `http://localhost:3003`)
- **Gửi Đánh giá (Review) cho Booking hoàn thành:** `review_controller.create` ➔ `review_service.createReview`
- **Đồng bộ tính toán (Event-driven Rating Sync):** `review_service.aggregateRestaurantRating` ➔ Cập nhật ngay vào SQL qua `restaurant_sql.updateRestaurantRating`

---

## 2. NHÀ HÀNG (RESTAURANT OWNER)

### 2.1 Quản lý Thông tin Cơ bản (`restaurant-service` - `http://localhost:3003`)
- **Cập nhật thông tin Profile nhà hàng:** `restaurant_controller.updateRestaurant`
- **Cấu hình Chính sách Đặt cọc (Deposit Policy):** `restaurant_controller.updateDepositPolicy` ➔ `restaurant_sql.updateDepositPolicy`
- **Quên mật khẩu (Owner):** Liên hệ Admin để cấp lại mật khẩu mới qua Email.
- **Cập nhật dữ liệu nhạy cảm (Commission, Premium):** Dành cho hệ thống nội bộ gọi qua API Gateway.

### 2.2 Quản lý Menu & Sơ đồ Bàn (`restaurant-service` - `http://localhost:3003`)
- **Thêm/Sửa/Xóa Món ăn (Menu Item):** `menu_controller.create`, `menu_controller.update`, `menu_controller.delete` (Mongoose DB)
- **Thêm/Sửa/Xóa Bàn (Tables):** `table_controller.create`, `table_controller.update`, `table_controller.delete` ➔ `table_sql.js`

### 2.3 Quản lý Booking (`booking-service` - `http://localhost:3004`)
- **Danh sách Booking đổ về nhà hàng:** `booking_controller.getRestaurantBookings`
- **Đổi trạng thái Booking (Xác nhận, Đã đến, Hủy, Hoàn thành):** `booking_controller.updateBookingStatus` ➔ `booking_service.updateBookingStatus` (Kèm đối soát cọc, chuyển tiền nội bộ sang Wallet nhà hàng)

### 2.4 Quản lý Doanh thu & Ví (`payment-service` - `http://localhost:3005` & `booking-service` - `http://localhost:3004`)
- **Xem Số dư Ví nội bộ (Wallet):** `wallet_controller.getWalletInfo` ➔ `wallet_sql.getWalletByRestaurantId`
- **Xem Lịch sử Giao dịch (Transactions):** `wallet_controller.getTransactionHistory`
- **Thống kê Doanh thu theo Chu kỳ (Ngày/Tuần/Tháng/Quý/Năm):** `restaurant_controller.revenueStats` ➔ Gọi Proxy qua `booking_service.getRevenueStatistics`
- **Yêu cầu Rút Tiền (Withdrawal):** `wallet_controller.requestWithdrawal` ➔ Chờ Admin duyệt.

---

## 3. ADMIN (QUẢN TRỊ VIÊN HỆ THỐNG) - `http://localhost:3006`

### 3.1 Dashboard Tổng quan & Doanh thu (`admin-service`)
- **Xem Thống kê Dashboard (Tổng User, Restaurants, Bookings):** `admin_controller.getStats` ➔ `admin_sql.getDashboardStats`
- **Thống kê Doanh thu Admin (Tiền Hoa Hồng):** `admin_controller.getAdminRevenueStats` ➔ `admin_sql.getAdminRevenueStats`

### 3.2 Quản lý Tài khoản & Nhà hàng (`admin-service`)
- **Tra cứu và Quản lý Users:** `admin_controller.getUsers`
- **Tạo Tài khoản Chủ Nhà hàng:** `admin_controller.createRestaurantOwner`
- **Kiểm duyệt Nhà hàng mới (Pending):** `admin_controller.getPendingRestaurants`
- **Duyệt Nhà hàng & Cấp Wallet:** `admin_controller.approveRestaurant` ➔ `admin_service.approveRestaurant` ➔ Gọi qua SQL để `ensureRestaurantWallet`
- **Reset mật khẩu cho Owner:** `admin_controller.resetOwnerPassword` ➔ Proxy qua `auth_controller.resetPasswordOwnerByAdmin`
- **Tạm ngưng Nhà hàng (Suspend):** `admin_controller.suspendRestaurant`

### 3.3 Quản lý Đặt bàn & Giao dịch (`admin-service` & `payment-service` - `http://localhost:3005`)
- **Tra cứu Toàn bộ Bookings hệ thống:** `admin_controller.getBookings`
- **Tra cứu Toàn bộ Giao dịch tài chính:** `admin_controller.getTransactions`
- **Duyệt / Từ chối Rút tiền:** `admin_controller.approveWithdrawal`, `admin_controller.rejectWithdrawal` ➔ Bắn lệnh sang `payment_controller.approveWithdrawal`

### 3.4 Đối soát Hoa Hồng (Commission Settlement)
- **Chạy Đối soát Hoa Hồng (Real run / Dry run):** `admin_controller.settleQuarterCommission` ➔ Tìm list Booking chưa thu commission (`booking_service.getCommissionCandidates`), sau đó trừ ví nhà hàng (`payment_service.chargeCommissionFromRestaurantToAdmin`), cuối cùng đánh dấu đã trả (`booking_service.markCommissionsPaid`).

---

## 4. AI & HỖ TRỢ (`AI-service` - `http://localhost:3007`)
- **Trợ lý ảo SeatNow AI:** Tư vấn nhà hàng, giải đáp bàn trống dựa trên AI (Gemini).

---

## 5. NOTIFICATION (`notification-service` - Worker)
- **Gửi Email/SMS:** Gửi thông báo booking thành công, nhắc lịch, xác thực OTP.