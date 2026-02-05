-- booking.sql.js - raw SQL queries for bookings (placeholder)
-- Create table example (run once in migrations)
CREATE TABLE Bookings (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RestaurantId INT NOT NULL,
  TableId INT NULL,
  UserId INT NOT NULL,
  Status VARCHAR(30) NOT NULL,
  ReservedAt DATETIME2 NOT NULL,
  CreatedAt DATETIME2 DEFAULT GETDATE()
);

-- Sample insert/query templates
