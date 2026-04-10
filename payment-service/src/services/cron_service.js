const cron = require('node-cron');
const { getPool, sql } = require('../config/db');
const paymentSql = require('../models/payment_sql');

// Khoi chay cac tien trinh chay ngam (Initialize background jobs)
function initCronJobs() {
  // Chay moi ngay vao luc 00:00 (Runs every day at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Starting automatic commission collection check...');
    await processAutoCommission();
  });

  console.log('[Cron] Background services initialized.');
}

// Logic xu ly thu phi tu dong (Auto commission processing logic)
async function processAutoCommission() {
  try {
    const pool = await getPool();

    // 1. Doc cau hinh tu DB (Read config from SystemConfigs)
    const configsRes = await pool.request().query('SELECT configKey, configValue FROM dbo.SystemConfigs');
    const configs = {};
    configsRes.recordset.forEach(c => {
      configs[c.configKey] = c.configValue;
    });

    const isEnabled = configs['AUTO_COMMISSION_ENABLED'] === 'true';
    const interval = configs['AUTO_COMMISSION_INTERVAL'] || 'MONTH';

    if (!isEnabled) {
      console.log('[Cron] Auto commission is disabled. Skipping.');
      return;
    }

    // 2. Kiem tra xem hom nay co phai ngay thu phi khong (Check if today is collection day)
    if (!isCollectionDay(interval)) {
      console.log(`[Cron] Today is not a collection day for interval: ${interval}. Skipping.`);
      return;
    }

    console.log(`[Cron] Processing commission collection for interval: ${interval}`);

    // 3. Lay danh sach nha hang co hoa hong chua thu (Get restaurants with unpaid commissions)
    // Chi lay cac don hang da giai ngan (isSettledToWallet = 1) nhung chua tra hoa hong (commissionPaid = 0)
    const pendingRes = await pool.request().query(`
      SELECT 
        restaurantId,
        SUM(commissionFee) as totalFee,
        COUNT(id) as bookingCount
      FROM dbo.Bookings
      WHERE isSettledToWallet = 1 AND commissionPaid = 0 AND ISNULL(commissionFee, 0) > 0
      GROUP BY restaurantId
    `);

    const restaurantsToCharge = pendingRes.recordset;
    if (restaurantsToCharge.length === 0) {
      console.log('[Cron] No pending commissions to collect.');
      return;
    }

    // 4. Lay thong tin vi Admin (Get Admin wallet)
    const adminWallet = await pool.request().query("SELECT TOP 1 id FROM dbo.Wallets WHERE userId IN (SELECT id FROM dbo.Users WHERE role = 'ADMIN')");
    if (!adminWallet.recordset[0]) {
      console.error('[Cron] Admin wallet not found. Cannot collect commission.');
      return;
    }
    const adminWalletId = adminWallet.recordset[0].id;

    // 5. Thuc hien thu phi cho tung nha hang (Process charging for each restaurant)
    for (const item of restaurantsToCharge) {
      try {
        const restaurantWallet = await pool.request()
          .input('rid', sql.UniqueIdentifier, item.restaurantId)
          .query('SELECT id FROM dbo.Wallets WHERE restaurantId = @rid');

        if (!restaurantWallet.recordset[0]) continue;
        const restaurantWalletId = restaurantWallet.recordset[0].id;

        const amount = Number(item.totalFee);
        const refCode = `AUTO-COMM-${new Date().toISOString().slice(0, 10)}-${item.restaurantId.slice(0, 8)}`;

        await paymentSql.chargeCommissionFromRestaurantToAdmin({
          restaurantWalletId,
          adminWalletId,
          amount,
          currency: 'VND',
          description: `Automatic commission collection (${interval})`,
          referenceCode: refCode
        });

        // Cap nhat cac booking thanh da tra hoa hong (Update bookings as paid)
        await pool.request()
          .input('rid2', sql.UniqueIdentifier, item.restaurantId)
          .query(`
            UPDATE dbo.Bookings 
            SET commissionPaid = 1, 
                updatedAt = SYSUTCDATETIME() 
            WHERE restaurantId = @rid2 AND isSettledToWallet = 1 AND commissionPaid = 0
          `);

        console.log(`[Cron] Successfully collected ${amount} VND from restaurant ${item.restaurantId}`);
      } catch (err) {
        console.error(`[Cron] Failed to collect commission for restaurant ${item.restaurantId}:`, err.message);
      }
    }

    console.log('[Cron] Auto commission collection completed.');
  } catch (err) {
    console.error('[Cron] Error in processAutoCommission:', err);
  }
}

// Ham ho tro kiem tra ngay thu phi (Helper to check if today matches interval)
function isCollectionDay(interval) {
  const now = new Date(); // Dung gio he thong (User's local time is 20:58, midnight will be soon)
  
  switch (interval.toUpperCase()) {
    case 'DAY':
      return true;
    case 'WEEK':
      return now.getDay() === 1; // Thu Hai (Monday is 1)
    case 'MONTH':
      return now.getDate() === 1; // Ngay mong 1 (1st of month)
    case 'QUARTER':
      // Dau quy: Thang 1, 4, 7, 10
      return now.getDate() === 1 && [0, 3, 6, 9].includes(now.getMonth());
    case 'YEAR':
      return now.getDate() === 1 && now.getMonth() === 0; // Ngay 1/1
    default:
      return false;
  }
}

module.exports = {
  initCronJobs,
  processAutoCommission // Export de co the trigger thu cong neu can (Export for manual trigger)
};
