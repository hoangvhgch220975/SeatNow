CREATE TABLE dbo.Tables (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Tables_id DEFAULT NEWID(),
  restaurantId  UNIQUEIDENTIFIER NOT NULL,
  tableNumber   NVARCHAR(50)     NOT NULL,
  capacity      INT              NOT NULL,
  type          NVARCHAR(30)     NOT NULL CONSTRAINT DF_Tables_type DEFAULT 'standard', -- standard, vip, outdoor
  location      NVARCHAR(100)    NULL,
  status        NVARCHAR(30)     NOT NULL CONSTRAINT DF_Tables_status DEFAULT 'available',

  createdAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Tables_createdAt DEFAULT SYSUTCDATETIME(),
  updatedAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Tables_updatedAt DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Tables PRIMARY KEY (id),
  CONSTRAINT FK_Tables_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  CONSTRAINT CK_Tables_type CHECK (type IN ('standard','vip','outdoor')),
  CONSTRAINT CK_Tables_status CHECK (status IN ('available','unavailable','maintenance')),
  CONSTRAINT CK_Tables_location CHECK (location IN (N'1st Floor', N'2nd Floor', N'3rd Floor', N'4th Floor', N'5th Floor', N'Rooftop', N'Terrace', N'Outdoor'))
);