-- Update CK_Transactions_type to new transaction type set.
-- Run this on existing database where dbo.Transactions already exists.

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Transactions_type'
    AND parent_object_id = OBJECT_ID('dbo.Transactions')
)
BEGIN
  ALTER TABLE dbo.Transactions DROP CONSTRAINT CK_Transactions_type;
END
GO

ALTER TABLE dbo.Transactions
ADD CONSTRAINT CK_Transactions_type
CHECK (type IN (
  'DEPOSIT_PAYMENT',
  'TOP_UP',
  'COMMISSION',
  'REFUND',
  'WITHDRAWAL',
  'SETTLEMENT'
));
GO
