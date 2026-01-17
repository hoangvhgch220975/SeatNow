const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getPool } = require(path.join(__dirname, '..', 'src', 'config', 'db'));

console.log('Using DB_SERVER=', process.env.DB_SERVER || '(not set)');
async function main() {
  try {
    const pool = await getPool();
    const res = await pool.request().query('SELECT 1 AS value');
    console.log('DB connection successful. Test query returned:', res.recordset);
    try { await pool.close(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err.message || err);
    process.exit(1);
  }
}

main();
