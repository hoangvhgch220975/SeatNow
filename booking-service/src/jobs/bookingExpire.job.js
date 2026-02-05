/**
 * bookingExpire.job.js - scheduled job to expire old pending bookings (placeholder)
 */
const cron = require('node-cron');
const { sql, getPool } = require('../config/db');
const availability = require('../services/availability_service');
const bookingSql = require('../models/booking_sql');

// Job để hủy các booking ở trạng thái PENDING quá hạn
async function expirePending() {
  const pool = await getPool();
  const min = parseInt(process.env.PENDING_EXPIRE_MIN || '15', 10);

  // find pending bookings older than threshold and cancel them via bookingSql.cancelBooking
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
      const updated = await bookingSql.cancelBooking(r.id, ['PENDING'], null, '[AUTO_EXPIRED]');
      if (updated) {
        await availability.invalidateAvailability({ restaurantId: updated.restaurantId, bookingDate: updated.bookingDate, bookingTime: updated.bookingTime });
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

  // find confirmed bookings past grace period and mark them NO_SHOW (use cancelBooking to set reason)
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
      // use cancelBooking to set cancellationReason; keep NO_SHOW status by using updateStatus then set reason
      const updated = await bookingSql.updateStatus(r.id, ['CONFIRMED'], 'NO_SHOW', 'cancelledAt');
      if (updated) {
        // set cancellationReason and cancelledBy (null)
        const final = await bookingSql.cancelBooking(updated.id, ['NO_SHOW'], null, '[AUTO_NO_SHOW]');
        if (final) {
          await availability.invalidateAvailability({ restaurantId: final.restaurantId, bookingDate: final.bookingDate, bookingTime: final.bookingTime });
        }
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
}

module.exports = { startBookingJobs };
