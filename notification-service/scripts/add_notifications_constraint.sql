-- Script: Thêm CHECK CONSTRAINT cho cột type trong bảng dbo.Notifications
-- Đảm bảo chỉ các loại hoạt động hợp lệ mới được chèn vào bảng

-- Xóa constraint cũ nếu đã tồn tại (để script idempotent)
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = 'CK_Notifications_type'
    AND parent_object_id = OBJECT_ID('dbo.Notifications')
)
BEGIN
  ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_type;
  PRINT 'Dropped existing CK_Notifications_type.';
END

-- Thêm CHECK constraint mới
ALTER TABLE dbo.Notifications
  ADD CONSTRAINT CK_Notifications_type
  CHECK (type IN (
    'BOOKING_NEW',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_NO_SHOW',
    'TRANSACTION_DEPOSIT',
    'TRANSACTION_TOPUP',
    'TRANSACTION_WITHDRAW_APPROVED',
    'REVIEW_NEW',
    'COMMISSION_SETTLED',
    'ADMIN_BROADCAST'
  ));

PRINT 'CHECK constraint CK_Notifications_type added successfully.';
