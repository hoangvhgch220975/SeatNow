// SQL queries for Bookings (read-only helper)
module.exports = {
  getById: 'SELECT TOP 1 * FROM dbo.Bookings WHERE id = @id',
  listByRestaurant: 'SELECT * FROM dbo.Bookings WHERE restaurantId = @restaurantId'
};
