const { getPool, sql } = require('../config/sql');

async function getRestaurantById(id) {
  const pool = await getPool();
  const res = await pool.request().input('id', sql.UniqueIdentifier, id).query('SELECT TOP 1 * FROM dbo.Restaurants WHERE id = @id');
  return res.recordset[0];
}

module.exports = { getRestaurantById };
