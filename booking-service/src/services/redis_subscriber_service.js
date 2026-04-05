/**
 * redis_subscriber_service.js
 * Lắng nghe các sự kiện từ Redis Keyspace Notifications (cụ thể là sự kiện hết hạn key)
 * để đồng bộ trạng thái bàn về 'available' khi hết 1 slot giữ bàn.
 */
const { createClient } = require('redis');
const socket = require('../sockets/booking_socket');

let subClient = null;

/**
 * Khởi tạo subscriber và cấu hình Redis
 */
async function initRedisSubscriber() {
  if (subClient) return subClient;

  subClient = createClient({ url: process.env.REDIS_URL });
  subClient.on('error', (err) => console.error('[Redis Sub Error]', err.message));

  await subClient.connect();
  console.log('[Redis Sub] Connected to Redis for Keyspace Notifications');

  // Bật tính năng Keyspace Notifications cho các sự kiện Expired (Ex)
  // K: Keyspace events, E: Keyevent events, x: Expired events
  try {
    const configClient = createClient({ url: process.env.REDIS_URL });
    await configClient.connect();
    await configClient.configSet('notify-keyspace-events', 'Ex');
    await configClient.disconnect();
    console.log('[Redis Sub] Configured notify-keyspace-events to Ex');
  } catch (err) {
    console.warn('[Redis Sub] Could not set CONFIG notify-keyspace-events. Ensure Redis user has permissions.', err.message);
  }

  // Đăng ký kênh nhận sự kiện hết hạn cho database 0
  const channel = '__keyevent@0__:expired';
  await subClient.subscribe(channel, (message) => {
    // message chính là key vừa bị hết hạn
    handleExpiration(message);
  });

  return subClient;
}

/**
 * Xử lý khi một key bị hết hạn
 * Pattern: table:hold:restaurantId:tableId:bookingDate:bookingTime
 */
function handleExpiration(key) {
  if (!key.startsWith('table:hold:')) return;

  console.log(`[Redis Sub] Key expired: ${key}`);
  const parts = key.split(':');
  
  // parts: ['table', 'hold', restaurantId, tableId, bookingDate, bookingTime]
  if (parts.length >= 6) {
    const restaurantId = parts[2];
    const tableId = parts[3];
    const bookingDate = parts[4];
    const bookingTime = parts[5];

    // Phát socket cho Frontend biết bàn này đã trống trở lại (Zero-Latency)
    try {
      socket.emitTableStatusChanged({
        restaurantId,
        tableId,
        bookingDate,
        bookingTime,
        status: 'available'
      });
      console.log(`[Redis Sub] Released expired hold for table ${tableId}`);
    } catch (err) {
      console.error('[Redis Sub] Socket emit error:', err.message);
    }
  }
}

module.exports = { initRedisSubscriber };
