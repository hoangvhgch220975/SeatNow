-- Create dbo.Wallets table (SeatNow)
IF NOT EXISTS (SELECT 1 FROM sys.schemas s JOIN sys.tables t ON s.schema_id = t.schema_id WHERE s.name = 'dbo' AND t.name = 'Wallets')
BEGIN
	CREATE TABLE dbo.Wallets (
		id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
		userId        UNIQUEIDENTIFIER NULL,
		restaurantId  UNIQUEIDENTIFIER NULL,
		balance       FLOAT NOT NULL DEFAULT 0,
		lockedAmount  FLOAT NOT NULL DEFAULT 0,
		createdAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
		updatedAt     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
		CONSTRAINT PK_Wallets PRIMARY KEY (id),
		CONSTRAINT UQ_Wallets_userId UNIQUE (userId),
		CONSTRAINT UQ_Wallets_restaurantId UNIQUE (restaurantId),
		CONSTRAINT CK_Wallets_owner CHECK (
			(userId IS NOT NULL AND restaurantId IS NULL)
			OR (userId IS NULL AND restaurantId IS NOT NULL)
		)
	);

	-- Optional foreign keys: enable if Users and Restaurants tables exist
	IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('dbo'))
	BEGIN
		ALTER TABLE dbo.Wallets
			ADD CONSTRAINT FK_Wallets_user FOREIGN KEY (userId) REFERENCES dbo.Users(id);
	END

	IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Restaurants' AND schema_id = SCHEMA_ID('dbo'))
	BEGIN
		ALTER TABLE dbo.Wallets
			ADD CONSTRAINT FK_Wallets_restaurant FOREIGN KEY (restaurantId) REFERENCES dbo.Restaurants(id);
	END

	PRINT 'Created dbo.Wallets';
END
ELSE
	PRINT 'dbo.Wallets already exists';

