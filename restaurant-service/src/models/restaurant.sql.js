// SQL queries for Restaurants (placeholder)
module.exports = {
  getById: 'SELECT TOP 1 * FROM dbo.Restaurants WHERE id = @id',
  search: 'SELECT * FROM dbo.Restaurants WHERE name LIKE @q'
};
