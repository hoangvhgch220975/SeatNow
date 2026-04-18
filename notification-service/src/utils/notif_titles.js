/**
 * notif_titles.js - Centralized map of notification event types to human-readable titles
 */

module.exports = {
  // Đặt chỗ (Booking)
  BOOKING_NEW: "New Booking Received",
  BOOKING_CONFIRMED: "Booking Confirmed",
  BOOKING_CANCELLED: "Booking Cancelled",
  BOOKING_NO_SHOW: "Guest No-Show Detected",
  BOOKING_ARRIVED: "Guest Arrived",
  BOOKING_COMPLETED: "Booking Completed",
  
  // Giao dịch & Thanh toán
  TRANSACTION_TOPUP: "Top-up Successful",
  TRANSACTION_WITHDRAW_REQUESTED: "Withdrawal Request",
  WITHDRAWAL_REQUESTED: "Withdrawal Request", // Dự phòng cho payment-service
  TRANSACTION_WITHDRAW_APPROVED: "Withdrawal Approved",
  TRANSACTION_WITHDRAW_REJECTED: "Withdrawal Rejected",
  TRANSACTION_DEPOSIT: "Deposit Received",
  
  // Vận hành đối tác (Partner/Admin)
  PARTNER_REQUEST_SUBMITTED: "New Partner Request",
  RESTAURANT_CREATED: "New Restaurant Pending Approval",
  RESTAURANT_APPROVED: "Restaurant Approved",
  RESTAURANT_ACTIVATED: "Restaurant Activated",
  RESTAURANT_DEACTIVATED: "Restaurant Deactivated",
  RESTAURANT_SUSPENDED: "Restaurant Suspended",
  
  // Đánh giá & Phản hồi
  REVIEW_NEW: "New Review Received",
  
  // Hệ thống & Khác
  COMMISSION_SETTLED: "Commission Settled",
  ADMIN_BROADCAST: "Admin Broadcast",
  SYSTEM_NOTIFICATION: "System Notification"
};
