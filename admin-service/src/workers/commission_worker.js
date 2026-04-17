const cron = require('node-cron');
const adminSql = require('../models/admin_sql');
const adminService = require('../services/admin_service');

// Ham khoi tao va chay worker thu phi hoa hong
function initCommissionWorker() {
  console.log('[CommissionWorker] Initializing...');

  // Chay moi gio mot lan de kiem tra cau hinh va thuc hien thu phi neu can
  // Hoac co the chay vao luc 00:00 hang ngay.
  cron.schedule('0 * * * *', async () => {
    try {
      console.log(`[CommissionWorker] Running heartbeat check at ${new Date().toISOString()}`);
      
      const enabledRecord = await adminSql.getSystemConfig('AUTO_COMMISSION_ENABLED');
      const isEnabled = enabledRecord && enabledRecord.configValue === 'true';

      if (!isEnabled) {
        console.log('[CommissionWorker] Auto commission is disabled. Skipping.');
        return;
      }

      const intervalRecord = await adminSql.getSystemConfig('AUTO_COMMISSION_INTERVAL');
      const interval = intervalRecord ? intervalRecord.configValue : 'MONTH';
      
      const now = new Date();
      let shouldRun = false;

      // Logic quyet dinh thoi diem chay dua tren interval
      switch (interval) {
        case 'DAY':
          // Chay vao khung gio 00:xx moi ngay
          if (now.getHours() === 0) shouldRun = true;
          break;
        case 'WEEK':
          // Chay vao thu 2 (day 1) khung gio 00:xx
          if (now.getDay() === 1 && now.getHours() === 0) shouldRun = true;
          break;
        case 'MONTH':
          // Chay vao ngay 1 hang thang khung gio 00:xx
          if (now.getDate() === 1 && now.getHours() === 0) shouldRun = true;
          break;
        case 'QUARTER':
          // Chay vao ngay 1 cua cac thang dau quy (1, 4, 7, 10) khung gio 00:xx
          if (now.getDate() === 1 && [0, 3, 6, 9].includes(now.getMonth()) && now.getHours() === 0) shouldRun = true;
          break;
        case 'YEAR':
          // Chay vao ngay 1 thang 1 hang nam khung gio 00:xx
          if (now.getDate() === 1 && now.getMonth() === 0 && now.getHours() === 0) shouldRun = true;
          break;
      }

      if (shouldRun) {
        await executeAutoCollection(interval);
      }
    } catch (err) {
      console.error('[CommissionWorker] Error in heartbeat check:', err.message);
    }
  });
}

// Thuc thi quet nợ va thu phi
async function executeAutoCollection(interval) {
  console.log(`[CommissionWorker] Starting auto collection for interval: ${interval}`);
  
  // Xac dinh khoang thoi gian de quet (to: hien tai, from: lui lai 1 khoang an toan)
  const to = new Date();
  const from = new Date();
  
  // De an toan, ta quet lai du lieu cua 30 ngay gan nhat (hoac ngan hon tuy interval) 
  // de dam bao khong bo sot don nao chua thu phi.
  from.setDate(from.getDate() - 31); 

  try {
    // AdminUserId cho worker (co the dung mot ID dac biet hoac ID cua Super Admin dau tien)
    // O day ta tam thoi fix mot ID admin hoac lay tu env.
    const adminUserId = process.env.SYSTEM_ADMIN_ID || '00000000-0000-0000-0000-000000000000';

    const result = await adminService.collectCommissions({
      from,
      to,
      adminUserId,
      description: `Auto commission collection (${interval})`,
      contextKey: `auto:${interval}:${to.toISOString().split('T')[0]}`
    });

    console.log(`[CommissionWorker] Completed auto collection. Total charged: ${result.totalCharged}, Restaurants: ${result.restaurants.length}`);
  } catch (err) {
    console.error('[CommissionWorker] Execution failed:', err.message);
  }
}

module.exports = { initCommissionWorker };
