const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const userService = require(path.join(__dirname, '..', 'src', 'services', 'user_service'));
const { getPool } = require(path.join(__dirname, '..', 'src', 'config', 'db'));
const userSql = require(path.join(__dirname, '..', 'src', 'models', 'user_sql'));
const { sql } = require(path.join(__dirname, '..', 'src', 'config', 'db'));

let userId = process.env.TEST_USER_ID || process.argv[2];

async function resolveUserIdFallback() {
  if (userId) return userId;
  try {
    const pool = await getPool();
    const rs = await pool.request().query('SELECT TOP 10 id FROM dbo.Users');
    const row = rs.recordset[0];
    if (row && row.id) return row.id;
  } catch (e) {
    // ignore
  }
  return null;
}

async function run() {
  try {
    userId = await resolveUserIdFallback();
    if (!userId) {
      console.error('No user id provided and no users found in DB. Set TEST_USER_ID in .env or pass as arg.');
      process.exit(2);
    }

    console.log('Testing user service for userId=', userId);

    const me = await userService.getMe(userId);
    console.log('\n[getMe] ->', me);

    const wallet = await userService.getMyWallet(userId);
    console.log('\n[getMyWallet] ->', wallet);

    // Ensure user wallet exists (will create if missing)
    try {
      const ensured = await userSql.ensureWalletForUser(userId);
      console.log('\n[ensureWalletForUser] ->', ensured);
    } catch (e) {
      console.warn('ensureWalletForUser failed:', e && e.message ? e.message : e);
    }

    const points = await userService.getMyLoyaltyPoints(userId);
    console.log('\n[getMyLoyaltyPoints] ->', points);

    const bookings = await userService.getMyBookings(userId, { offset: 0, limit: 10 });
    console.log('\n[getMyBookings] ->', bookings);

    // Optionally ensure a restaurant wallet if TEST_RESTAURANT_ID provided
    const restaurantId = process.env.TEST_RESTAURANT_ID || process.argv[3];
    if (restaurantId) {
      try {
        const pool = await getPool();
        const rs = await pool.request()
          .input('restaurantId', sql.UniqueIdentifier, restaurantId)
          .query(`SELECT TOP 1 id, restaurantId, balance, lockedAmount FROM dbo.Wallets WHERE restaurantId = @restaurantId`);

        if (rs.recordset[0]) {
          console.log('\n[restaurant wallet exists] ->', rs.recordset[0]);
        } else {
          const ins = await pool.request()
            .input('restaurantId', sql.UniqueIdentifier, restaurantId)
            .query(`
              INSERT INTO dbo.Wallets (restaurantId, balance, lockedAmount)
              OUTPUT INSERTED.id, INSERTED.restaurantId, INSERTED.balance, INSERTED.lockedAmount, INSERTED.createdAt, INSERTED.updatedAt
              VALUES (@restaurantId, 0, 0)
            `);
          console.log('\n[ensureWalletForRestaurant] ->', ins.recordset[0]);
        }
      } catch (e) {
        console.warn('ensureWalletForRestaurant failed:', e && e.message ? e.message : e);
      }
    }

    const pool = await getPool();
    try { await pool.close(); } catch (_) {}
    console.log('\nAll tests finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    try { const pool = await getPool(); await pool.close(); } catch (_) {}
    process.exit(1);
  }
}

run();
