/**
 * db.js - Cấu hình và khởi tạo kết nối Database cho notification-service
 * Sử dụng cùng logic với booking-service (hỗ trợ cả LocalDB và Remote SQL Server)
 */
let pool;

// Phát hiện kết nối LocalDB để dùng driver phù hợp
const isLocalDb = /(\(localdb\)|\\)/i.test(process.env.DB_SERVER || '');
const sql = isLocalDb ? require('mssql/msnodesqlv8') : require('mssql');

const cfg = isLocalDb
  ? {
      driver: 'msnodesqlv8',
      connectionString: `Driver={${process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server'}};Server=${process.env.DB_SERVER};Database=${process.env.DB_NAME};Trusted_Connection=yes;`,
      options: { trustedConnection: true }
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: parseInt(process.env.DB_PORT || '1433', 10),
      database: process.env.DB_NAME,
      options: {
        encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
        trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() === 'true'
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
    };

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(cfg);
  return pool;
}

module.exports = { sql, getPool };
