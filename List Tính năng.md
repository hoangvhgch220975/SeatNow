# DANH SÁCH TÍNH NĂNG VÀ HÀM XỬ LÝ TƯƠNG ỨNG (SEATNOW)

Dưới đây là tài liệu tổng hợp những tính năng **ĐÃ HOÀN THIỆN** trong hệ thống SeatNow hiện tại, kèm theo tên Service, Base URL và hàm xử lý (Controller/Service/SQL) chịu trách nhiệm chính.

---

## 🚀 HỆ THỐNG API GATEWAY & COMMON

- **Base URL:** `http://localhost:7000`
- **Công nghệ:** .NET Ocelot API Gateway
- **Chức năng:** Hợp nhất 8 microservices, định tuyến (Routing), kiểm tra xác thực tập trung.
- **Bản đồ Định tuyến (Routing Map):**
  - **Auth Service (Port 3001):** `/api/v1/auth/*`
  - **User Service (Port 3002):** `/api/v1/users/*` (Yêu cầu JWT)
  - **Restaurant Service (Port 3003):** `/api/v1/restaurants/*`, `/api/v1/portfolio/*`
  - **Booking Service (Port 3004):** `/api/v1/bookings/*`, `/api/v1/booking-restaurants/*`, `/api/v1/owner/*` (Yêu cầu JWT)
  - **Payment Service (Port 3005):** `/api/v1/payment/*`
  - **Admin Service (Port 3006):** `/api/v1/admin/*` (Yêu cầu JWT + Role ADMIN)
  - **AI Service (Port 3007):** `/api/v1/ai/*` ➔ `Downstream: /api/ai/*` (Yêu cầu JWT)
  - **Notification Service (Port 3008):** `/api/v1/notifications/*`, `/api/v1/owner/activity/*` (Yêu cầu JWT)
- **JWT Key:** `vhTony_24_access` (Dùng chung cho toàn bộ hệ thống).

---

## 1. KHÁCH HÀNG (CUSTOMER)

### 1.1 Tài khoản & Xác thực (`auth_service` - `http://localhost:3001`)

- **Đăng ký/Đăng nhập:** `auth_controller.register`, `auth_controller.login`.
- **Xác thực OTP:** `auth_controller.verifyOtp`.
- **Quên mật khẩu (Tự động):** `auth_controller.forgotPasswordCustomer`. -> `Tự động tạo mật khẩu mới và gửi về email`
- **Tích lũy Điểm thưởng (Loyalty Points):** Xử lý cộng điểm tự động khi hoàn thành bữa ăn.
- **Xem / Cập nhật Profile (`user_service` - `http://localhost:3002`):** `user_controller.getProfile`, `user_controller.updateProfile`

### 1.2 Tìm kiếm & Khám phá Nhà hàng (`restaurant-service` - `http://localhost:3003`)

- **Tìm kiếm nhà hàng theo bộ lọc (Giá, Cuisine, Keyword):** `restaurant_controller.list` ➔ `restaurant_sql.findMany` (Tự động trả về `distanceKm` nếu có `lat/lng`)
- **Tìm kiếm Theo vị trí (Bán kính GPS / Near Me):** `restaurant_controller.list` (Hỗ trợ `lat`, `lng`, `radiusKm`, `sort=distance`)

### 1.3 Xem chi tiết Nhà hàng (`restaurant-service` - `http://localhost:3003`)

- **Xem thông tin chi tiết (Giờ mở cửa, mô tả, ảnh):** `restaurant_controller.detail` ➔ `restaurant_sql.findById`
- **Xem Menu món ăn:** `menu_controller.list` ➔ `menu_mongo.find`
- **Xem Đánh giá (Reviews):** `review_controller.list` ➔ `review_service.listReviews`

### 1.4 Đặt bàn & Thanh toán (`booking-service` - `http://localhost:3004` & `payment-service` - `http://localhost:3005`)

- **Tạo yêu cầu Đặt bàn (Pending):** `booking_controller.create` ➔ `booking_sql.createBooking` (Cơ chế Lock Redis ngăn Overbooking)
- **Kiểm tra Sức chứa & Khe giờ (Availability):** `restaurant_controller.availability` ➔ `booking_service.calculateAvailability` (Mặc định 2h/slot)
- **Thanh toán Tiền cọc (Deposit):** `booking_controller.payDeposit` ➔ Khách hàng thanh toán trực tiếp qua cổng (Momo/VNPay), hệ thống ghi nhận giao dịch.
- **Giữ chỗ bàn (Slot Lock):** Sử dụng Redis Lock để giữ bàn tạm thời trong quá trình khách thanh toán, tránh Overbooking.
- **Tạo/Quản lý Mã QR Code Check-in:** `booking_service.getQr` (Tạo QR PNG phục vụ check-in tại quầy)

### 1.5 Quản lý Booking (`booking-service` - `http://localhost:3004`)

- **Xem lịch sử đặt bàn:** `booking_controller.getUserBookings`
- **Xem chi tiết Booking:** `booking_controller.getDetail`
- **Khách hàng tự Hủy Booking:** `booking_controller.cancel` (Xét điều kiện hoàn cọc: Nếu trước 3 tiếng được hoàn, sau 3 tiếng mất cọc. Tiền cọc hoàn trả do Owner tự liên hệ khách).

### 1.6 Đánh giá & Rating (`restaurant-service` - `http://localhost:3003`)

- **Gửi Đánh giá cho Booking đã hoàn thành:** `review_controller.create` ➔ `review_service.createReview`
- **Đồng bộ Rating:** Tự động tổng hợp điểm trung bình và cập nhật vào SQL (`ratingAvg`).

---

## 2. NHÀ HÀNG (RESTAURANT OWNER)

### 2.1 Quản lý Thông tin Cơ bản (`restaurant-service` - `http://localhost:3003`)

- **Tạo nhà hàng (Owner):** `restaurant_controller.create` (Trạng thái `pending`).
- **Cập nhật Profile:** `restaurant_controller.update` (Bao gồm sửa Slug).
- **Cấu hình Chính sách Cọc:** `restaurant_controller.updateDepositPolicy`

### 2.2 Quản lý Menu & Sơ đồ Bàn (`restaurant-service` - `http://localhost:3003`)

- **Quản lý Món ăn (Menu):** `menu_controller.create/update/remove` (MongoDB).
- **Quản lý Bàn (Tables):** `table_controller.create/update/remove` (SQL).

### 2.3 Quản lý Booking (`booking-service` - `http://localhost:3004`)

- **Nhận danh sách Booking:** `booking_controller.getRestaurantBookings`
- **Cập nhật trạng thái:** `booking_controller.updateStatus` (Xác nhận, Check-in, Hủy, Hoàn thành).
- **Hủy đơn (Owner):** `booking_controller.cancel` (Luôn hoàn tiền cọc cho khách).

### 2.4 Thống kê & Dashboard (`restaurant-service` & `booking-service`)

### 2.4. Hệ thống Thống kê & Báo cáo (Analytics System)

Hệ thống cung cấp dữ liệu trực quan cho từng nhà hàng và toàn bộ chuỗi (Portfolio):

- **Thống kê linh hoạt:** Hỗ trợ lọc dữ liệu theo khoảng thời gian tùy chỉnh (Ngày, Tuần, Tháng, Năm).
- **Phân loại Khách hàng (Guest-Size Stats):** Phân tích thói quen đặt bàn dựa trên số lượng khách:
  - **Couple (2 khách):** Đếm số lượng và tỷ lệ %.
  - **Small Groups (4-6 khách):** Đếm số lượng và tỷ lệ %.
  - **Party (8+ khách):** Đếm số lượng và tỷ lệ %.
- **Phân bổ theo giờ (Hourly Distribution):** Phân tích các khung giờ bận rộn nhất dựa trên lượt đặt bàn thành công (theo tuần, tháng, quý, năm).
- **Chỉ số kinh doanh:** Tổng doanh thu thực tế (`totalRevenue` = Tiền cọc - Phí hoa hồng), Tổng doanh thu gộp (`totalGrossRevenue` = Toàn bộ tiền cọc trước phí), Tổng lượt đặt, Tỷ lệ hủy/No-show.
- **Báo cáo Portfolio:** Tổng hợp hiệu quả kinh doanh của tất cả nhà hàng thuộc cùng một chủ sở hữu (bao gồm biểu đồ doanh thu và phân bổ giờ).
- **Rating & Reviews Portfolio:** Điểm đánh giá trung bình trọng số (`portfolioRatingAvg`) và tổng số lượt đánh giá (`portfolioTotalReviews`) cho toàn chuỗi nhà hàng.
- **Hàm xử lý:** `booking_controller.getHourlyStats`, `booking_controller.getOwnerHourlyStats`, `booking_sql.getRevenueStatistics`, `booking_sql.getOwnerPortfolioSummary`.

## 3. Vai trò người dùng (User Roles)

- **Thống kê Portfolio (Global Summary):** `restaurant_controller.portfolioSummary` ➔ Tổng quan doanh thu, số lượng booking, tỷ lệ hủy cho toàn bộ các nhà hàng của Owner.
- **Thống kê Summary lẻ (Restaurant Stats):** `restaurant_controller.getRestaurantStatsSummary` ➔ Các con số KPI chính cho nhày hàng cụ thể.
- **Thống kê Doanh thu (Revenue Stats Chart):** `restaurant_controller.revenueStats` ➔ Dữ liệu biểu đồ theo chu kỳ thời gian.

### 2.5 Ví & Rút tiền (`payment-service` - `http://localhost:3005`)

- **Số dư & Lịch sử Giao dịch:** `wallet_controller.getWalletInfo`, `wallet_controller.getTransactionHistory`
- **Yêu cầu Rút Tiền:** `wallet_controller.requestWithdrawal`

---

## 3. ADMIN (QUẢN TRỊ HỆ THỐNG) - `http://localhost:3006`

### 3.1 Dashboard & Duyệt Nhà hàng

- **Thống kê Tổng quan:** `admin_controller.getStats`
- **Tạo Nhà hàng hộ Owner:** `admin_controller.createRestaurant` ➔ Trạng thái mặc định là **`active`**.
- **Duyệt Nhà hàng mới:** `admin_controller.approveRestaurant` ➔ Tự động gán Wallet.
- **Tạm ngưng Nhà hàng:** `admin_controller.suspendRestaurant`

### 3.2 Giao dịch & Đối soát

- **Duyệt Rút tiền:** `admin_controller.approveWithdrawal`
- **Đối soát Hoa hồng định kỳ (Settlement):** `admin_controller.settleQuarterCommission` ➔ Khấu trừ hoa hồng từ ví nhà hàng vào ví Admin.

---

## 4. AI SERVICE (`AI-service` - `http://localhost:3007`)

- **SeatNow AI Assistant:** Tư vấn tìm bàn, gợi ý món ăn và giải đáp thắc mắc người dùng qua Gemini AI.

---

## 5. NOTIFICATION SERVICE (`notification-service` - `http://localhost:3008`)

- **Đa kênh:** Xử lý gửi Email, Firebase Push và Web Notifications.
- **Tự động hóa:** Gửi thông báo khi `booking_confirmed`, `booking_cancelled`.
- **OTP:** Duy trì gửi mã xác thực qua các kênh liên lạc.
- **Owner Activity Feed (Lịch sử hoạt động):** Lưu trữ thông báo bền vững vào Database (`dbo.Notifications`), cung cấp API lấy danh sách hoạt động gần đây cho Dashboard của chủ sở hữu (phân trang, lọc theo loại, đánh dấu đã đọc).
  - **Các loại hoạt động hỗ trợ:** `BOOKING_NEW`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_NO_SHOW`, `TRANSACTION_DEPOSIT`, `TRANSACTION_TOPUP`, `TRANSACTION_WITHDRAW_APPROVED`, `REVIEW_NEW`, `COMMISSION_SETTLED`, `ADMIN_BROADCAST`.
  - **API:** `GET /api/v1/owner/activity`, `PUT /api/v1/owner/activity/:id/read`, `PUT /api/v1/owner/activity/read-all`.
  - **Hàm xử lý:** `activity.controller.js` ➔ `notification.model.js` ➔ `dbo.Notifications`.

---

# 📖 MÔ TẢ CHI TIẾT CÁC LUỒNG NGHIỆP VỤ (BUSINESS FLOWS)

## 1. Luồng Tài khoản & Xác thực (Authentication Flow)

- **Đăng ký/Đăng nhập:** Người dùng sử dụng Email và Số điện thoại chính chủ. (Lưu ý: Đối tác nhà hàng không thể tự đăng ký, chỉ có Admin kiểm duyệt và tạo tài khoản).
- **Quên mật khẩu (Flow chi tiết):**
  1. **Yêu cầu:** Người dùng nhập **Email** và **Số điện thoại** đã đăng ký.
  2. **OTP:** Hệ thống kiểm tra sự trùng khớp, sau đó gửi mã OTP qua Email/SMS.
  3. **Verify:** Người dùng nhập mã OTP để xác thực quyền sở hữu.
  4. **Reset:** Sau khi verify thành công, hệ thống **tự động tạo một mật khẩu ngẫu nhiên dài 8 ký số**.
  5. **Thông báo:** Mật khẩu mới này được gửi trực tiếp về Email của người dùng để họ sử dụng đăng nhập lại.

## 2. Luồng Đặt bàn & Slot thời gian (Booking Slot Flow)

- **Quy tắc Slot:**
  - Mỗi slot mặc định kéo dài **2 tiếng**.
  - Hệ thống tự động chia slot dựa trên giờ mở/đóng cửa (VD: Mở 10h -> Slot 1: 10:00-12:00, Slot 2: 12:00-14:00...).
- **Giữ chỗ tạm thời (Temporary Lock):**
  - Khi khách hàng vừa chọn một bàn (đang trong bước điền thông tin), Redis sẽ thực hiện **Lock bàn đó trong 2 phút**.
  - Điều này ngăn chặn việc 2 người cùng chọn 1 bàn tại một thời điểm cực ngắn.
  - Nếu sau 2 phút khách không nhấn tiếp tục tạo booking, bàn sẽ được thả ra (Unlock).
- **Trạng thái Slot:**
  - Một slot khi đã có booking `Confirmed` hoặc `Arrived` sẽ ở trạng thái **Bận** trong suốt 2 tiếng đó.
  - **Giải phóng slot:** Slot sẽ tự động trống lại sau khi hết 2 tiếng thời gian slot HOẶC ngay lập tức khi nhân viên nhà hàng nhấn chuyển trạng thái booking sang **`Completed`**.

## 3. Luồng Đặt bàn & Thanh toán (Booking & Payment Flow)

1. **Tìm kiếm:** Khách hàng tìm nhà hàng dựa trên vị trí, cuisine hoặc từ khóa.
2. **Kiểm tra bàn:** Hệ thống gọi `calculateAvailability` để tính toán các bàn còn trống dựa trên sức chứa và sơ đồ bàn trong khung giờ khách chọn (mặc định slots 2h).
3. **Tạo Booking:** Khi khách chọn bàn, hệ thống tạo một booking với trạng thái `pending`.
4. **Giữ chỗ (Lock):** Redis sẽ thực hiện "Lock" khung giờ/bàn đó trong120 phút để chờ khách thanh toán. Trong thời gian này, người khác không thể đặt trùng.
5. **Thanh toán:** Khách thực hiện trả tiền cọc (Deposit) qua ví điện tử.
6. **Xác nhận:** `payment-service` nhận tín hiệu thành công -> Cập nhật trạng thái booking sang `confirmed` -> Giải phóng Lock Redis (chuyển thành booking chính thức) -> Gửi Email/Push xác nhận kèm mã QR.

## 4. Luồng Check-in & Phục vụ (Check-in & Service Flow)

1. **Đến nhà hàng:** Khách hàng trình mã QR cho nhân viên.
2. **Quét mã:** Nhân viên dùng App nhà hàng quét QR -> Gọi API `updateStatus` để chuyển booking sang `arrived`.
3. **Xử lý tài chính (Ngay khi Arrived):** Lúc này hệ thống sẽ tự động:
   - Đánh dấu booking đủ điều kiện để Admin thực hiện **Duyệt/Thu phí hoa hồng** (Settlement).
   - Tiền cọc (sau khi trừ phí) sẽ được ghi nhận vào **Ví (Wallet)** của nhà hàng.
4. **Hoàn thành bữa ăn:** Sau khi khách ăn xong, nhân viên chuyển trạng thái sang `completed`.
5. **Đánh giá & Loyalty:** Hệ thống cộng điểm thưởng (Loyalty Points) và gửi thông báo mời khách hàng đánh giá trải nghiệm (Review).

## 5. Luồng Hủy bàn & Hoàn tiền (Cancellation & Refund Flow)

1. **Yêu cầu hủy:** Khách hàng hoặc Chủ nhà hàng thực hiện lệnh `cancel`.
2. **Xét điều kiện hoàn trả cọc (3-Hour Rule):**
   - **Owner hủy:** Được tính là hoàn tiền cọc cho khách. **Quy trình:** Owner tự liên hệ trả tiền cho khách, hệ thống không tính khoản này vào doanh thu.
   - **Customer hủy sớm (>= 3 tiếng trước giờ đặt):** Được tính là hoàn tiền cọc (`depositRefunded = 1`). **Quy trình:** Owner tự liên hệ trả tiền cho khách, hệ thống không tính khoản này vào doanh thu.
   - **Customer hủy muộn (< 3 tiếng hoặc No-show):** Khách bị mất cọc. Tiền cọc sau khi trừ phí hoa hồng của hệ thống sẽ được tính vào **Doanh thu** và cộng vào **Ví (Wallet)** của nhà hàng.
3. **Giải phóng slot:** Ngay sau khi hủy, bàn sẽ được thả (Unlock) để khách khác có thể đặt.
4. **Hàm xử lý:** `booking_service.cancel` ➔ `booking_sql.cancelBooking` (Cập nhật flag `depositRefunded` để loại trừ khỏi báo cáo tài chính).

## 6. Luồng Chăm sóc & Vận hành Nhà hàng (Restaurant Onboarding)

1. **Gửi yêu cầu hợp tác (Be my member):** Chủ nhà hàng gửi yêu cầu hợp tác (Bao gồm Tên, SĐT, Email, Hình ảnh/tài liệu chứng minh) thông qua API Partner Request.
2. **Duyệt & Cấp tài khoản:** Admin kiểm tra danh sách yêu cầu. Nếu hợp lệ, Admin nhấn duyệt (Approve) để hệ thống tự động tạo tài khoản Owner và gửi mật khẩu đăng nhập tạm thời về email cho chủ nhà hàng.
3. **Kích hoạt:** Hệ thống tự động chuyển trạng thái nhà hàng sang `active`, kích hoạt Slug và khởi tạo **Ví (Wallet)** riêng cho nhà hàng đó.
4. **Thiết lập:** Chủ nhà hàng đăng nhập bằng mật khẩu tạm, đổi mật khẩu mới và bắt đầu thiết lập Menu (MongoDB) cùng Sơ đồ bàn/Phòng (SQL) để có thể nhận khách.

## 7. Luồng Đối soát & Rút tiền (Financial Settlement)

1. **Doanh thu tích lũy:** Tiền cọc từ các booking **ARRIVED** được tích lũy trong ví nhà hàng.
2. **Yêu cầu rút tiền:** Chủ nhà hàng gửi yêu cầu rút tiền (`requestWithdrawal`) khi đạt số dư tối thiểu.
3. **Phê duyệt:** Admin kiểm tra và nhấn `Approve` để thực hiện lệnh chuyển khoản thực tế.
4. **Thu phí dịch vụ:** Định kỳ (hàng quý/tháng), Admin chạy luồng `settleQuarterCommission` để thu phí hoa hồng đã thỏa thuận từ ví nhà hàng sang ví tổng của Admin.

## 8. Luồng Tài chính (Financial Flow)

- **Tiền cọc:** Thu trực tiếp từ khách -> Hệ thống giữ hộ.
- **Settle:** Thu tiền cọc vào **Ví nhà hàng** ngay khi booking chuyển sang `Arrived`.
- **Rút tiền:** Chủ nhà hàng gửi lệnh rút -> Admin phê duyệt -> Chuyển tiền về tài khoản ngân hàng của Owner.
- **Hoa hồng:** Admin chạy lệnh đối soát định kỳ để khấu trừ hoa hồng từ ví nhà hàng về ví Admin.

## 9. Luồng Thông báo (Notification Flow)

1. **Thông báo Real-time:** Khi có booking mới (bất kể cọc hay không cọc), hệ thống gửi thông báo đến chủ nhà hàng ngay lập tức qua Socket.IO.
2. **Email:** Hệ thống gửi email thông báo đến khách hàng khi đặt bàn thành công, hủy bàn, hoặc có thay đổi về trạng thái booking.
3. **Lưu trữ bền vững (Persistent):** Mỗi thông báo `web` gửi đến Owner đều được Worker tự động lưu vào bảng `dbo.Notifications`. Điều này đảm bảo Owner có thể xem lại lịch sử dù đang offline.
4. **Activity Feed API:** Owner gọi `GET /api/v1/owner/activity` để lấy toàn bộ lịch sử. Kết hợp với Socket để cập nhật real-time mà không cần reload trang.

## 10. Luồng AI Assistant cho Khách (Customer AI Flow)

1. **Tương tác:** Khách hàng gửi câu hỏi cho AI Assistant (ví dụ: "Tìm nhà hàng Ý gần đây").
2. **Xử lý:** AI Service sử dụng Gemini để phân tích ý định và truy vấn cơ sở dữ liệu nhà hàng.
3. **Trả kết quả:** AI trả về danh sách nhà hàng phù hợp kèm theo tóm tắt và hình ảnh.
4. **Đặt bàn:** Khách hàng có thể chọn một nhà hàng từ kết quả và chuyển sang luồng đặt bàn thông thường.

## 11. Luồng AI Assistant cho Admin (Admin AI Flow)

1. **Tương tác:** Admin gửi câu hỏi cho AI Assistant (ví dụ: "Thống kê doanh thu nhà hàng trong tháng").
2. **Xử lý:** AI Service sử dụng Gemini để phân tích ý định và truy vấn cơ sở dữ liệu nhà hàng.
3. **Trả kết quả:** AI trả về các thông tin, số liệu, báo cáo, thống kê và các thông tin khác theo yêu cầu của Admin.
4. **Thực hiện:** Admin dựa trên các thông tin, số liệu, báo cáo, thống kê và các thông tin khác theo yêu cầu của Admin để đưa ra quyết định và thực hiện các hành động cần thiết.

#
