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

    // Hold table (UI selection lock - 2 phút)
    socket.on('holdTable', async (data, callback) => {
      try {
        const { restaurantId, tableId, bookingDate, bookingTime } = data;
        const userId = String(socket.user?.id || socket.id);
        const redis = await getRedis();
        const holdKey = `table:hold:${restaurantId}:${tableId}:${bookingDate}:${bookingTime}`;
        const holdTTL = parseInt(process.env.TABLE_HOLD_TTL_SEC || '120', 10);

        console.log('[holdTable] Start', { restaurantId, tableId, userId, holdKey });

        // 0. Check Table status in DB
        const bookingSql = require('../models/booking_sql');
        const table = await bookingSql.getTable(tableId);
        if (!table || table.status !== 'available') {
          return callback?.({ error: 'Table is currently unavailable' });
        }

        // 1. Auto-release ANY other tables
        try {
          const userPattern = `table:hold:${restaurantId}:*:${bookingDate}:${bookingTime}`;
          const existingKeys = await redis.keys(userPattern);
          for (const k of existingKeys) {
            const holder = await redis.get(String(k));
            if (String(holder) === userId && String(k) !== holdKey) {
              await redis.del(String(k));
              io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', { restaurantId, bookingDate, bookingTime });
            }
          }
        } catch (scanErr) {
          console.warn('[holdTable] Scan/Release error:', scanErr.message);
        }

        // 2. Check targets
        const existing = await redis.get(holdKey);
        if (existing && String(existing) !== userId) {
          return callback?.({ error: 'Table is being selected by another user' });
        }

        // 3. Set new hold
        try {
          // Explicitly cast both key and value
          await redis.set(String(holdKey), String(userId));
          await redis.expire(String(holdKey), holdTTL);
        } catch (setErr) {
          console.error('[holdTable] Redis SET error:', setErr.message);
          return callback?.({ error: `Redis SET error: ${setErr.message}` });
        }

        // 4. Cache Invalidation
        try {
          const availPrefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
          const availKeys = await redis.keys(`${availPrefix}*`);
          for (const ak of availKeys) {
            await redis.del(String(ak));
          }
        } catch (cacheErr) {
          console.warn('[holdTable] Cache error:', cacheErr.message);
        }

        io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', { restaurantId, bookingDate, bookingTime });
        callback?.({ success: true, expiresIn: holdTTL });
      } catch (err) {
        console.error('[holdTable] Global error:', err.message);
        callback?.({ error: `GLOBAL: ${err.message}` });
      }
    });

    // Release hold
    socket.on('releaseHold', async (data, callback) => {
      try {
        const { restaurantId, tableId, bookingDate, bookingTime } = data;
        if (!restaurantId || !tableId || !bookingDate || !bookingTime) {
          return callback?.({ error: 'Missing required fields' });
        }

        const userId = String(socket.user?.id || socket.id);
        const redis = await getRedis();
        const holdKey = `table:hold:${restaurantId}:${tableId}:${bookingDate}:${bookingTime}`;

        // Only release if held by this user
        const existing = await redis.get(holdKey);
        if (existing && String(existing) === userId) {
          await redis.del(holdKey);
          
          // Invalidate availability cache for this slot
          try {
            const availPrefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
            const availKeys = await redis.keys(`${availPrefix}*`);
            for (const ak of availKeys) {
              await redis.del(ak);
            }
          } catch (cacheErr) {
            console.error('Release Cache Invalidation error:', cacheErr.message);
          }

          io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', { restaurantId, bookingDate, bookingTime });
        }

        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    // Auto-release holds on disconnect
    socket.on('disconnect', async () => {
      try {
        const userId = String(socket.user?.id || socket.id);
        const redis = await getRedis();
        
        // Scan và release tất cả holds của user này
        for await (const key of redis.scanIterator({ MATCH: 'table:hold:*', COUNT: 100 })) {
          const holder = await redis.get(key);
          if (holder === userId) {
            await redis.del(key);
            // Extract info từ key để invalidate cache
            const parts = key.split(':');
            if (parts.length >= 6) {
              const restaurantId = parts[2];
              const bookingDate = parts[4];
              const bookingTime = parts[5];
              
              const availPrefix = `restaurant:${restaurantId}:tables:available:${bookingDate}:${bookingTime}:`;
              for await (const k of redis.scanIterator({ MATCH: `${availPrefix}*`, COUNT: 200 })) {
                await redis.del(k);
              }

              io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', { restaurantId, bookingDate, bookingTime });
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

function emitAvailabilityChanged(restaurantId, payload) {
  if (!io || !restaurantId) return;
  io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', { ...payload, restaurantId });
}

function emitBookingChanged({ restaurantId, customerId, payload }) {
  if (!io || !restaurantId) return;

  // owner/admin nhận đầy đủ
  io.to(`restaurant:${restaurantId}:owners`).emit('bookingChanged', payload);

  // customer nhận booking của mình
  if (customerId) io.to(`user:${customerId}`).emit('bookingChanged', payload);
}

module.exports = {
  initSocket,
  getIO,
  emitAvailabilityChanged,
  emitBookingChanged
};
