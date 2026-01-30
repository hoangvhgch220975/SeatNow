/**
 * restaurant.sql.js - raw SQL queries (placeholders)
 */
module.exports = {
  getById: 'SELECT TOP 1 * FROM dbo.Restaurants WHERE id = @id',
  search: 'SELECT * FROM dbo.Restaurants WHERE name LIKE @q'
};
