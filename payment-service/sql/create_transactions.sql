CREATE TABLE dbo.Transactions (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Transactions_id DEFAULT NEWID(),
  walletId      UNIQUEIDENTIFIER NOT NULL,
  bookingId     UNIQUEIDENTIFIER NULL,

  type          NVARCHAR(30)     NOT NULL,
  amount        FLOAT            NOT NULL,
  balanceBefore FLOAT            NOT NULL,
  balanceAfter  FLOAT            NOT NULL,

  description   NVARCHAR(MAX)    NULL,
  paymentMethod NVARCHAR(50)     NULL,
  referenceCode NVARCHAR(100)    NULL,

  status        NVARCHAR(30)     NOT NULL CONSTRAINT DF_Transactions_status DEFAULT 'pending', -- pending, completed, failed
  createdAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Transactions_createdAt DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Transactions PRIMARY KEY (id),
  CONSTRAINT FK_Transactions_wallet FOREIGN KEY (walletId) REFERENCES dbo.Wallets(id),
  CONSTRAINT FK_Transactions_booking FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id),
  CONSTRAINT CK_Transactions_type CHECK (type IN ('TOP_UP','DEPOSIT_PAYMENT','DEPOSIT_REFUND','COMMISSION_FEE','WITHDRAWAL')),
  CONSTRAINT CK_Transactions_status CHECK (status IN ('pending','completed','failed'))
);