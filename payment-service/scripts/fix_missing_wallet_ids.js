require('dotenv').config();
const { getPool, sql } = require('../src/config/db');

async function run() {
  console.log('--- Starting fix_missing_wallet_ids.js ---');
  try {
    const pool = await getPool();
    
    console.log('Finding DEPOSIT_PAYMENT transactions with NULL walletId...');
    
    // Su dung lenh UPDATE JOIN de toi uu hoa thay vi loop tung dong
    const query = `
      UPDATE tx
      SET tx.walletId = w.id
      FROM dbo.Transactions tx
      INNER JOIN dbo.Bookings b ON tx.bookingId = b.id
      INNER JOIN dbo.Wallets w ON b.restaurantId = w.restaurantId
      WHERE tx.type = 'DEPOSIT_PAYMENT'
        AND tx.walletId IS NULL
    `;
    
    const result = await pool.request().query(query);
    
    console.log(`Successfully updated ${result.rowsAffected[0]} transactions.`);
    console.log('--- Fix completed ---');
    process.exit(0);
  } catch (err) {
    console.error('Error during fix:', err);
    process.exit(1);
  }
}

run();
