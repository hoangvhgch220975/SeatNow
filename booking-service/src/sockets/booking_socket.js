/**
 * booking.socket.js - socket helpers (placeholder)
 */
// src/sockets/booking.socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getRedis } = require('../config/redis');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', credentials: true }
  });

  // optional auth (token có thể có hoặc không)
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || '').replace('Bearer ', '');

    if (!token) return next(); // guest socket allowed (public rooms only)

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: payload.sub || payload.userId || payload.id, role: payload.role };
    } catch {
      // token sai -> vẫn cho connect nhưng coi như guest
      socket.user = null;
    }
    return next();
  });

  io.on('connection', (socket) => {
    // customer: auto join user room
    if (socket.user?.id) socket.join(`user:${socket.user.id}`);

    // public room: ai cũng join được để nhận availabilityChanged
    socket.on('joinRestaurant', (restaurantId) => {
      if (!restaurantId) return;
      socket.join(`restaurant:${restaurantId}`);
    });

    // private owner room: chỉ owner/admin
    socket.on('joinRestaurantOwners', (restaurantId) => {
      if (!restaurantId) return;
      const role = socket.user?.role;
      if (role === 'RESTAURANT_OWNER' || role === 'ADMIN') {
        socket.join(`restaurant:${restaurantId}:owners`);
      }
    });

    socket.on('leaveRestaurant', (restaurantId) => {
      if (!restaurantId) return;
      socket.leave(`restaurant:${restaurantId}`);
      socket.leave(`restaurant:${restaurantId}:owners`);
    });

    // Giữ bàn (UI selection lock - 2 phút)
    socket.on('holdTable', async (data, callback) => {
      try {
        const { restaurantId, tableId, bookingDate, bookingTime } = data;
        const userId = String(socket.user?.id || socket.id);
        const redis = await getRedis();
        const holdKey = `table:hold:${restaurantId}:${tableId}:${bookingDate}:${bookingTime}`;
        const holdTTL = parseInt(process.env.TABLE_HOLD_TTL_SEC || '120', 10);

        console.log('[holdTable] Start', { restaurantId, tableId, userId, holdKey });

        // 0. Kiểm tra trạng thái bàn trong DB
        const bookingSql = require('../models/booking_sql');
        const table = await bookingSql.getTable(tableId);
        if (!table || table.status !== 'available') {
          return callback?.({ error: 'Table is currently unavailable' });
        }

        // 1. Tự động giải phóng các bàn khác đã giữ trước đó cho slot này
        try {
          const userPattern = `table:hold:${restaurantId}:*:${bookingDate}:${bookingTime}`;
          const existingKeys = await redis.keys(userPattern);
          for (const k of existingKeys) {
            const holder = await redis.get(String(k));
            if (String(holder) === userId && String(k) !== holdKey) {
              await redis.del(String(k));
              // Extract tableId từ key để thông báo statusChanged
              const parts = k.split(':');
              const oldTableId = parts[3];
              emitTableStatusChanged({ restaurantId, tableId: oldTableId, bookingDate, bookingTime, status: 'available' });
            }
          }
        } catch (scanErr) {
          console.warn('[holdTable] Scan/Release error:', scanErr.message);
        }

        // 2. Kiểm tra xem bàn đã có ai giữ chưa
        const existing = await redis.get(holdKey);
        if (existing && String(existing) !== userId) {
          return callback?.({ error: 'Table is being selected by another user' });
        }

        // 3. Thực hiện giữ bàn mới
        try {
          await redis.set(String(holdKey), String(userId));
          await redis.expire(String(holdKey), holdTTL);
        } catch (setErr) {
          console.error('[holdTable] Redis SET error:', setErr.message);
          return callback?.({ error: `Redis SET error: ${setErr.message}` });
        }

        // 4. Xóa cache availability liên quan
        try {
          const availPrefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
          const availKeys = await redis.keys(`${availPrefix}*`);
          for (const ak of availKeys) {
            await redis.del(String(ak));
          }
        } catch (cacheErr) {
          console.warn('[holdTable] Cache error:', cacheErr.message);
        }

        // Phát sự kiện mới: Bàn đã được giữ (màu cam)
        emitTableStatusChanged({ restaurantId, tableId, bookingDate, bookingTime, status: 'held' });
        
        callback?.({ success: true, expiresIn: holdTTL });
      } catch (err) {
        console.error('[holdTable] Global error:', err.message);
        callback?.({ error: `GLOBAL: ${err.message}` });
      }
    });

    // Giải phóng lượt giữ bàn
    socket.on('releaseHold', async (data, callback) => {
      try {
        const { restaurantId, tableId, bookingDate, bookingTime } = data;
        if (!restaurantId || !tableId || !bookingDate || !bookingTime) {
          return callback?.({ error: 'Missing required fields' });
        }

        const userId = String(socket.user?.id || socket.id);
        const redis = await getRedis();
        const holdKey = `table:hold:${restaurantId}:${tableId}:${bookingDate}:${bookingTime}`;

        // Chỉ được giải phóng nếu chính mình đang giữ
        const existing = await redis.get(holdKey);
        if (existing && String(existing) === userId) {
          await redis.del(holdKey);
          
          // Xóa cache availability
          try {
            const availPrefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
            const availKeys = await redis.keys(`${availPrefix}*`);
            for (const ak of availKeys) {
              await redis.del(ak);
            }
          } catch (cacheErr) {
            console.error('Release Cache Invalidation error:', cacheErr.message);
          }

          // Phát sự kiện: Bàn đã trống trở lại (màu xanh)
          emitTableStatusChanged({ restaurantId, tableId, bookingDate, bookingTime, status: 'available' });
        }

        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    // Tự động giải phóng khi mất kết nối
    socket.on('disconnect', async () => {
      try {
        const userId = String(socket.user?.id || socket.id);
        const redis = await getRedis();
        
        // Cần lấy tất cả keys mang prefix table:hold
        const pattern = 'table:hold:*';
        const keys = await redis.keys(pattern);

        for (const key of keys) {
          const holder = await redis.get(key);
          if (holder === userId) {
            await redis.del(key);
            
            // Phân tích key để lấy thông tin phát socket
            const parts = key.split(':');
            if (parts.length >= 6) {
              const restaurantId = parts[2];
              const tableId = parts[3];
              const bookingDate = parts[4];
              const bookingTime = parts[5];
              
              const availPrefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
              const availKeys = await redis.keys(`${availPrefix}*`);
              for (const ak of availKeys) {
                await redis.del(ak);
              }

              // Thông báo bàn trống đến những người dùng khác
              emitTableStatusChanged({ restaurantId, tableId, bookingDate, bookingTime, status: 'available' });
            }
          }
        }
      } catch (err) {
        console.error('Error releasing holds on disconnect:', err.message);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

/**
 * Phát sự kiện thay đổi danh sách bàn trống (chung cho cả restaurant)
 * @deprecated Dùng emitTableStatusChanged để tối ưu tốc độ đồng bộ từng bàn
 */
function emitAvailabilityChanged(restaurantId, payload) {
  if (!io || !restaurantId) return;
  io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', { ...payload, restaurantId });
}

/**
 * Phát sự kiện thay đổi trạng thái chi tiết của một bàn (Zero-Latency)
 * @param {Object} data - { restaurantId, tableId, bookingDate, bookingTime, status }
 * @param {string} data.status - 'available' | 'held' | 'occupied'
 */
function emitTableStatusChanged({ restaurantId, tableId, bookingDate, bookingTime, status }) {
  if (!io || !restaurantId) return;
  
  console.log(`[Socket] Broadcasting tableStatusChanged: ${tableId} -> ${status}`);
  
  io.to(`restaurant:${restaurantId}`).emit('tableStatusChanged', {
    restaurantId,
    tableId,
    bookingDate,
    bookingTime,
    status
  });
}

function emitBookingChanged({ restaurantId, customerId, payload }) {
  if (!io || !restaurantId) return;

  // Chủ nhà hàng nhận đầy đủ thông tin thay đổi
  io.to(`restaurant:${restaurantId}:owners`).emit('bookingChanged', payload);

  // Khách hàng nhận thông báo về đơn của chính mình
  if (customerId) io.to(`user:${customerId}`).emit('bookingChanged', payload);
}

module.exports = {
  initSocket,
  getIO,
  emitAvailabilityChanged,
  emitTableStatusChanged,
  emitBookingChanged
};
