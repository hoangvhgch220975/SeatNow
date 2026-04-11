/**
 * notif_titles.js - Centralized map of notification event types to human-readable titles
 */

module.exports = {
  // Booking related
  BOOKING_NEW: "New Booking Received",
  BOOKING_CONFIRMED: "Booking Confirmed",
  BOOKING_CANCELLED: "Booking Cancelled",
  BOOKING_NO_SHOW: "Guest No-Show Detected",
  BOOKING_ARRIVED: "Guest Arrived",
  BOOKING_COMPLETED: "Booking Completed",
  
  // Transaction / Payment related
  TRANSACTION_TOPUP: "Wallet Top-up Successful",
  TRANSACTION_WITHDRAW_APPROVED: "Withdrawal Request Approved",
  TRANSACTION_WITHDRAW_REJECTED: "Withdrawal Request Rejected",
  TRANSACTION_DEPOSIT: "Deposit Payment Received",
  
  // Other events
  REVIEW_NEW: "New Review Received",
  COMMISSION_SETTLED: "Commission Settled",
  ADMIN_BROADCAST: "System Message",
  RESTAURANT_ACTIVATED: "Restaurant Activated",
  RESTAURANT_DEACTIVATED: "Restaurant Deactivated"
};
