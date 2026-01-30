/**
 * restaurant.service (placeholder)
 * Implement search/detail logic using `models/*.sql.js` and caching.
 */
const { getPool } = require('../config/sql');

async function getRestaurantById(id) {
  const pool = await getPool();
  const res = await pool.request().input('id', id).query('SELECT TOP 1 * FROM dbo.Restaurants WHERE id = @id');
  return res.recordset ? res.recordset[0] : null;
}

module.exports = { getRestaurantById };
