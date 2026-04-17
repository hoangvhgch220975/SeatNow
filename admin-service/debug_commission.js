require('dotenv').config();
const { getPool, sql } = require('./src/config/sql');

async function debug() {
  const pool = await getPool();
  const query = `
    SELECT
      status,
      commissionFee,
      depositAmount,
      depositRefunded,
      (CASE 
        WHEN UPPER(ISNULL(status, '')) IN ('ARRIVED', 'COMPLETED', 'NO_SHOW', 'CONFIRMED') THEN ISNULL(commissionFee, 0)
        WHEN UPPER(ISNULL(status, '')) = 'CANCELLED' AND ISNULL(depositRefunded, 0) = 0 THEN ISNULL(depositAmount, 0)
        ELSE 0 
      END) as calc_commission
    FROM dbo.Bookings
  `;
  const rs = await pool.request().query(query);
  console.table(rs.recordset);
  const total = rs.recordset.reduce((s, x) => s + x.calc_commission, 0);
  console.log('--- TOTAL ---');
  console.log(total);
  process.exit(0);
}

debug();
