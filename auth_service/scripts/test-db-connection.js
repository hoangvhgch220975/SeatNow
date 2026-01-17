// scripts/test-db-connection.js
// Quick script to verify SQL Server connection using src/config/db.js

require('dotenv').config();

const { sql, getPool } = require('../src/config/db');

async function main() {
  let pool;
  try {
    console.log('Connecting to database...');
    pool = await getPool();
    const res = await pool.request().query('SELECT 1 AS ok');
    console.log('DB connected. Query result:', res.recordset[0]);
  } catch (err) {
    console.error('DB connection test failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    try {
      if (pool && typeof pool.close === 'function') await pool.close();
      if (sql && typeof sql.close === 'function') await sql.close();
    } catch (e) {
      // ignore
    }
  }
}

if (require.main === module) main();

module.exports = { main };
