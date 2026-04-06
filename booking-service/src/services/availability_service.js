const { sql, getPool } = require('../config/db');
const { getRedis } = require('../config/redis');
const socket = require('../sockets/booking_socket');

const ACTIVE = ['PENDING','CONFIRMED','ARRIVED'];

// Hàm tạo khóa cache cho truy vấn bàn trống (redis key)
function cacheKey(restaurantId, date, time, guests) {
  return `restaurant:${restaurantId}:tables:available:${date}:${time}:${guests}`;
}

// Hàm lấy danh sách bàn trống theo tiêu chí
async function getAvailableTables({ restaurantId, bookingDate, bookingTime, numGuests, forceRefresh = false }) {
  const redis = await getRedis();
  const formattedDate = typeof bookingDate === 'string' ? bookingDate : new Date(bookingDate).toISOString().split('T')[0];
  const key = cacheKey(restaurantId, formattedDate, bookingTime, numGuests);
  
  if (!forceRefresh) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  }

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
          AND b.bookingTime LIKE @bookingTime + '%'
          AND b.status IN (${ACTIVE.map((_, i) => `@s${i}`).join(',')})
      )
    ORDER BY t.capacity ASC, t.tableNumber ASC
  `);

  // Filter out tables that are currently held by someone (UI selection lock)
  const tables = [];
  for (const table of rs.recordset) {
    const holdKey = `table:hold:${restaurantId}:${table.id}:${bookingDate}:${bookingTime}`;
    const held = await redis.get(holdKey);
    if (!held) {
      tables.push(table);
    }
  }

  const ttl = parseInt(process.env.AVAIL_CACHE_TTL_SEC || '300', 10);
  await redis.set(key, JSON.stringify(tables), { EX: ttl });
  return tables;
}

// Hàm vô hiệu hóa cache bàn trống khi có booking mới hoặc thay đổi
async function invalidateAvailability({ restaurantId, bookingDate, bookingTime }) {
  const redis = await getRedis();
  const formattedDate = typeof bookingDate === 'string' ? bookingDate : new Date(bookingDate).toISOString().split('T')[0];
  const prefix = `restaurant:${restaurantId}:tables:available:${formattedDate}:${bookingTime}:`;
  const keys = [];
  for await (const k of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
    if (k && typeof k === 'string') {
      keys.push(k);
    }
  }
  // Delete keys individually
  for (const key of keys) {
    try {
      await redis.del(key);
    } catch (err) {
      console.error('Redis del error for key:', key, err.message);
    }
  }
  try { socket.emitAvailabilityChanged(restaurantId, { bookingDate, bookingTime }); } catch (e) {}
}

module.exports = { getAvailableTables, invalidateAvailability };


