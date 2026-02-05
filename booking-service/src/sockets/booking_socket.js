/**
 * booking.socket.js - socket helpers (placeholder)
 */
// src/sockets/booking.socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

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
  });

  return io;
}

function getIO() {
  return io;
}

function emitAvailabilityChanged(restaurantId, payload) {
  if (!io || !restaurantId) return;
  io.to(`restaurant:${restaurantId}`).emit('availabilityChanged', payload);
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
