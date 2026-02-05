CREATE TABLE dbo.Bookings (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Bookings_id DEFAULT NEWID(),
  bookingCode     NVARCHAR(30)     NOT NULL,
  customerId      UNIQUEIDENTIFIER NOT NULL,
  restaurantId    UNIQUEIDENTIFIER NOT NULL,
  tableId         UNIQUEIDENTIFIER NULL,

  bookingDate     DATE             NOT NULL,
  bookingTime     NVARCHAR(10)     NOT NULL, -- "19:00"
  numGuests       INT              NOT NULL,
  status          NVARCHAR(30)     NOT NULL CONSTRAINT DF_Bookings_status DEFAULT 'PENDING',
  notes           NVARCHAR(MAX)    NULL,

  depositRequired BIT              NOT NULL CONSTRAINT DF_Bookings_depositRequired DEFAULT 0,
  depositAmount   FLOAT            NULL,
  depositPaid     BIT              NOT NULL CONSTRAINT DF_Bookings_depositPaid DEFAULT 0,
  depositPaidAt   DATETIME2(3)     NULL,
  depositRefunded BIT              NOT NULL CONSTRAINT DF_Bookings_depositRefunded DEFAULT 0,

  commissionFee   FLOAT            NULL,
  commissionPaid  BIT              NOT NULL CONSTRAINT DF_Bookings_commissionPaid DEFAULT 0,

  confirmedAt     DATETIME2(3)     NULL,
  checkedInAt     DATETIME2(3)     NULL,
  completedAt     DATETIME2(3)     NULL,
  cancelledAt     DATETIME2(3)     NULL,

  createdAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Bookings_createdAt DEFAULT SYSUTCDATETIME(),
  updatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Bookings_updatedAt DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Bookings PRIMARY KEY (id),
  CONSTRAINT UQ_Bookings_bookingCode UNIQUE (bookingCode),
  CONSTRAINT FK_Bookings_customer FOREIGN KEY (customerId) REFERENCES dbo.Users(id),
  CONSTRAINT FK_Bookings_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  CONSTRAINT FK_Bookings_table FOREIGN KEY (tableId) REFERENCES dbo.Tables(id),
  CONSTRAINT CK_Bookings_status CHECK (status IN ('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','NO_SHOW'))
);