let sql;
let pool;

const isLocalDb = (s) => String(s || '').toLowerCase().includes('(localdb)') || String(s || '').includes('\\');

const loadSql = () => {
  if (!sql) {
    const useV8 = String(process.env.DB_DRIVER || '').toLowerCase() === 'msnodesqlv8' || isLocalDb(process.env.DB_SERVER);
    sql = useV8 ? require('mssql/msnodesqlv8') : require('mssql');
  }
  return sql;
};

const getConfig = () => {
  const server = process.env.DB_SERVER;
  const useV8 = String(process.env.DB_DRIVER || '').toLowerCase() === 'msnodesqlv8' || isLocalDb(server);

  if (useV8) {
    const driver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
    return {
      driver: 'msnodesqlv8',
      connectionString: `Driver={${driver}};Server=${server};Database=${process.env.DB_NAME};Trusted_Connection=yes;`
    };
  }

  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() === 'true'
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
  };
};

async function getPool() {
  if (pool) return pool;
  const mssql = loadSql();
  pool = await mssql.connect(getConfig());
  return pool;
}

module.exports = { sql: loadSql(), getPool };
