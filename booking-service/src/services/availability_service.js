const { sql, getPool } = require('../config/db');
const { getRedis } = require('../config/redis');
const socket = require('../sockets/booking_socket');

const ACTIVE = ['PENDING','CONFIRMED','ARRIVED'];

// Hàm tạo khóa cache cho truy vấn bàn trống (redis key)
function cacheKey(restaurantId, date, time, guests) {
  return `restaurant:${restaurantId}:tables:available:${date}:${time}:${guests}`;
}

// Hàm lấy danh sách bàn trống theo tiêu chí
async function getAvailableTables({ restaurantId, bookingDate, bookingTime, numGuests }) {
  const redis = await getRedis();
  const key = cacheKey(restaurantId, bookingDate, bookingTime, numGuests);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const pool = await getPool();
  const req = pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('bookingDate', sql.Date, bookingDate)
    .input('bookingTime', sql.NVarChar(10), bookingTime)
    .input('numGuests', sql.Int, numGuests);

  ACTIVE.forEach((s, i) => req.input(`s${i}`, sql.NVarChar(30), s));

  const rs = await req.query(`
    SELECT t.id, t.tableNumber, t.capacity, t.type, t.location
    FROM dbo.Tables t
    WHERE t.restaurantId=@restaurantId
      AND t.status='available'
      AND t.capacity >= @numGuests
      AND NOT EXISTS (
        SELECT 1 FROM dbo.Bookings b
        WHERE b.tableId=t.id
          AND b.bookingDate=@bookingDate
          AND b.bookingTime=@bookingTime
          AND b.status IN (${ACTIVE.map((_, i) => `@s${i}`).join(',')})
      )
    ORDER BY t.capacity ASC, t.tableNumber ASC
  `);

  const ttl = parseInt(process.env.AVAIL_CACHE_TTL_SEC || '300', 10);
  await redis.set(key, JSON.stringify(rs.recordset), { EX: ttl });
  return rs.recordset;
}

// Hàm vô hiệu hóa cache bàn trống khi có booking mới hoặc thay đổi
async function invalidateAvailability({ restaurantId, bookingDate, bookingTime }) {
  const redis = await getRedis();
  const prefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
  for await (const k of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
    await redis.del(k);
  }
  try { socket.emitAvailabilityChanged(restaurantId, { bookingDate, bookingTime }); } catch (e) {}
}

module.exports = { getAvailableTables, invalidateAvailability };
