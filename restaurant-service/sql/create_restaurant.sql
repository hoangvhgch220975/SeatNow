CREATE TABLE dbo.Restaurants (
  id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Restaurants_id DEFAULT NEWID(),
  ownerId           UNIQUEIDENTIFIER NOT NULL,
  name              NVARCHAR(150)    NOT NULL,
  slug              NVARCHAR(200)    NOT NULL,
  address           NVARCHAR(255)    NOT NULL,
  latitude          FLOAT            NOT NULL,
  longitude         FLOAT            NOT NULL,
  phone             NVARCHAR(20)     NOT NULL,
  email             NVARCHAR(255)    NULL,

  cuisineTypeJson   NVARCHAR(MAX)    NULL,   -- JSON array
  priceRange        INT              NOT NULL, -- 1-4
  ratingAvg         FLOAT            NOT NULL CONSTRAINT DF_Restaurants_ratingAvg DEFAULT 0,
  ratingCount       INT              NOT NULL CONSTRAINT DF_Restaurants_ratingCount DEFAULT 0,

  description       NVARCHAR(MAX)    NULL,
  imagesJson        NVARCHAR(MAX)    NULL,   -- JSON array
  openingHoursJson  NVARCHAR(MAX)    NULL,   -- JSON object

  depositEnabled    BIT              NOT NULL CONSTRAINT DF_Restaurants_depositEnabled DEFAULT 0,
  depositPolicyJson NVARCHAR(MAX)    NULL,   -- JSON object

  commissionRate    FLOAT            NOT NULL CONSTRAINT DF_Restaurants_commissionRate DEFAULT 10,
  status            NVARCHAR(30)     NOT NULL CONSTRAINT DF_Restaurants_status DEFAULT 'pending', -- pending, active, suspended
  isPremium         BIT              NOT NULL CONSTRAINT DF_Restaurants_isPremium DEFAULT 0,

  createdAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Restaurants_createdAt DEFAULT SYSUTCDATETIME(),
  updatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Restaurants_updatedAt DEFAULT SYSUTCDATETIME(),

  CONSTRAINT PK_Restaurants PRIMARY KEY (id),
  CONSTRAINT UQ_Restaurants_slug UNIQUE (slug),
  CONSTRAINT FK_Restaurants_owner FOREIGN KEY (ownerId) REFERENCES dbo.Users(id),
  CONSTRAINT CK_Restaurants_priceRange CHECK (priceRange BETWEEN 1 AND 4),
  CONSTRAINT CK_Restaurants_status CHECK (status IN ('pending','active','suspended'))
);