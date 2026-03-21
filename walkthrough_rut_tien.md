# Báo Cáo Hoàn Thành: Sửa Luồng Dòng Tiền & Rút Tiền

Tôi đã hoàn thành việc lập trình các tính năng theo đúng Implementation Plan mà bạn đã phê duyệt:

## 1. Cộng tiền cọc vào Ví nhà hàng
- Sửa đổi hàm [completeDepositTransaction](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/payment-service/src/models/payment_sql.js#435-534) trong [payment-service/src/models/payment_sql.js](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/payment-service/src/models/payment_sql.js).
- Khi Webhook hoặc Return callback từ VNPay/MoMo xác nhận thanh toán đặt cọc thành công:
  - Hệ thống tự động tra cứu `restaurantId` từ `bookingId`.
  - Cộng số tiền khách đặt cọc (`amount`) trực tiếp vào `balance` của Nhà hàng.
  - Ghi log Giao dịch và thay đổi `status = 'completed'`.

## 2. Trigger Real-time Event khi có cọc
- Thêm lời gọi API nội bộ từ `payment-service` sang `booking-service` ngay khi xử lý xong Webhook.
- Trong [booking-service/src/routes/booking_route.js](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/booking-service/src/routes/booking_route.js), mở thêm endpoint `POST /internal/bookings/:id/payment-success`.
- Trong [booking-service/src/services/booking_service.js](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/booking-service/src/services/booking_service.js), thêm hàm [paymentSuccess](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/booking-service/src/services/booking_service.js#322-342) để nhận sự kiện và bắn Realtime Socket (`socket.emitBookingChanged({ type: 'payment_success' })`) xuống trình duyệt của nhà hàng và khách hàng.
  
*(Lưu ý: status của booking vẫn giữ nguyên là `PENDING` đúng theo yêu cầu, chờ nhà hàng chủ động Confirm).*

## 3. Quản lý Rút Tiền (Withdrawal)
Đã bổ sung chuỗi API hoàn chỉnh để xử lý việc Rút tiền:

### Dành cho nhà hàng (`payment-service`)
- Chức năng: Tạo yêu cầu rút tiền.
- Kiểm tra điều kiện: Số dư (`balance`) phải >= số tiền muốn rút.
- Hành động logic: Trừ số tiền đó ra khỏi `balance` và cộng tạm vào số bị giữ (`lockedAmount`), phòng trường hợp rủi ro. Trạng thái giao dịch khởi tạo là `pending`.
- Thêm file dịch vụ mới: [payment-service/src/services/withdrawal_service.js](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/payment-service/src/services/withdrawal_service.js).

### Dành cho Admin (`admin-service`)
- **Duyệt lệnh rút tiền (Approve):** Gọi `POST /withdrawals/:id/approve`. Admin duyệt thì tiền trong `lockedAmount` sẽ bị trừ (hiểu là đã chuyển khoản ngoài cho nhà hàng thành công), giao dịch chuyển trạng thái `completed`.
- **Từ chối lệnh rút tiền (Reject):** Gọi `POST /withdrawals/:id/reject`. Nếu Admin từ chối, `lockedAmount` sẽ được trừ đi và trả lại (cộng về) `balance` khả dụng cho nhà hàng, giao dịch chuyển trạng thái `failed`.

Toàn bộ code mới đảm bảo chạy qua `ISOLATION_LEVEL.SERIALIZABLE` của SQL Server để tránh các lỗi Race Condition khi xử lý tiền bạc.

---
Vui lòng thiết lập Postman hoặc Frontend UI để thử nghiệm các endpoint này. Nếu có bất kỳ lỗi nào phát sinh liên quan đến Database local, hãy chạy các script tạo bảng Transaction tương ứng nếu bị thiếu schema.
