CREATE TABLE dbo.Tables (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Tables_id DEFAULT NEWID(),
  restaurantId  UNIQUEIDENTIFIER NOT NULL,
  tableNumber   NVARCHAR(50)     NOT NULL,
  capacity      INT              NOT NULL,
  type          NVARCHAR(30)     NOT NULL CONSTRAINT DF_Tables_type DEFAULT 'normal', -- normal, vip, outdoor
  location      NVARCHAR(100)    NULL,
  status        NVARCHAR(30)     NOT NULL CONSTRAINT DF_Tables_status DEFAULT 'available',

  createdAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Tables_createdAt DEFAULT SYSUTCDATETIME(),
  updatedAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Tables_updatedAt DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Tables PRIMARY KEY (id),
  CONSTRAINT FK_Tables_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id),
  CONSTRAINT CK_Tables_type CHECK (type IN ('normal','vip','outdoor')),
  CONSTRAINT CK_Tables_status CHECK (status IN ('available','unavailable','maintenance'))
);