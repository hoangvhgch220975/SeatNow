/**
 * bookingExpire.job.js - scheduled job to expire old pending bookings
 */
const cron = require('node-cron');
const { sql, getPool } = require('../config/db');
const availability = require('../services/availability_service');
const bookingSvc = require('../services/booking_service');

// Job để hủy các booking ở trạng thái PENDING quá hạn
async function expirePending() {
  const pool = await getPool();
  const min = parseInt(process.env.PENDING_EXPIRE_MIN || '15', 10);

  // Tìm các booking PENDING quá hạn
  const toExpire = await pool.request()
    .input('min', sql.Int, min)
    .query(`
      SELECT id
      FROM dbo.Bookings
      WHERE status='PENDING'
        AND createdAt < DATEADD(minute, -@min, SYSUTCDATETIME())
    `);

  for (const r of toExpire.recordset) {
    try {
      // Sử dụng service thay vì SQL trực tiếp để kích hoạt Socket events (Zero-Latency)
      const updated = await bookingSvc.cancel(r.id, null, '[AUTO_EXPIRED]');
      if (updated) {
        await availability.invalidateAvailability({ 
          restaurantId: updated.restaurantId, 
          bookingDate: updated.bookingDate, 
          bookingTime: updated.bookingTime 
        });
      }
    } catch (e) {
      console.warn('[job] expirePending cancel error', e.message || e);
    }
  }
}

// Job để đánh dấu các booking CONFIRMED là NO_SHOW nếu quá giờ đặt bàn + thời gian chờ
async function markNoShow() {
  const pool = await getPool();
  const grace = parseInt(process.env.NO_SHOW_GRACE_MIN || '30', 10);

  // Tìm các booking CONFIRMED đã quá giờ chờ
  const toNoShow = await pool.request()
    .input('grace', sql.Int, grace)
    .query(`
      SELECT id
      FROM dbo.Bookings
      WHERE status='CONFIRMED'
        AND DATEADD(minute, @grace,
            CAST(CONCAT(CONVERT(varchar(10), bookingDate, 23),' ', bookingTime, ':00') AS datetime2)
        ) < SYSUTCDATETIME()
    `);

  for (const r of toNoShow.recordset) {
    try {
      // Sử dụng service thay vì SQL trực tiếp để kích hoạt Socket events (Zero-Latency)
      const updated = await bookingSvc.noShow(r.id);
      if (updated) {
        await availability.invalidateAvailability({ 
          restaurantId: updated.restaurantId, 
          bookingDate: updated.bookingDate, 
          bookingTime: updated.bookingTime 
        });
      }
    } catch (e) {
      console.warn('[job] markNoShow cancel error', e.message || e);
    }
  }
}

// Hàm khởi động các job định kỳ
function startBookingJobs() {
  cron.schedule('*/1 * * * *', async () => {
    try { await expirePending(); } catch (e) { console.warn('[job] expirePending', e.message); }
    try { await markNoShow(); } catch (e) { console.warn('[job] markNoShow', e.message); }
  });

  // Job chốt commission theo lịch
  const commissionCron = process.env.COMMISSION_SETTLE_CRON || '30 1 * * *';
  cron.schedule(commissionCron, async () => {
    try {
      const result = await bookingSvc.autoSettleCommissions();
      if (result && result.length) {
        console.log('[job] autoSettleCommissions settled:', result.length, 'restaurants');
      }
    } catch (e) {
      console.warn('[job] autoSettleCommissions', e.message || e);
    }
  });
}

module.exports = { startBookingJobs };
