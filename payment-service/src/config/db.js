/**
 * db.js - SQL connection placeholder for payment-service
 */
const sql = require('mssql');

async function getPool() {
  const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: { trustServerCertificate: true }
  };
  return await sql.connect(config);
}

module.exports = { getPool };
