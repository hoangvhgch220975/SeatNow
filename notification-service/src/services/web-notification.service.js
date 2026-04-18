/**
 * web-notification.service.js - Socket.io service for realtime notifications
 */
let io;

/**
 * Initialize Socket.io
 * @param {object} socketIoInstance 
 */
function init(socketIoInstance) {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    const { userId, role } = socket.handshake.query;
    
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Socket] ✅ User ${userId} joined room: user:${userId}`);
    }
    
    if (role) {
      const normalizedRole = role.toUpperCase();
      socket.join(`role:${normalizedRole}`);
    }

    socket.on('disconnect', () => {
    });
  });
}

/**
 * Emit a notification to a specific user
 * @param {string} userId 
 * @param {string} event 
 * @param {object} payload 
 */
function sendWebNotification(userId, event, payload) {
  if (!io) {
    console.warn('Socket.io not initialized. Cannot send web notification.');
    return false;
  }

  io.to(`user:${userId}`).emit(event, {
    ...payload,
    timestamp: new Date().toISOString()
  });
  
  console.log(`Web notification sent to user:${userId} - Event: ${event}`);
  return true;
}

/**
 * Emit a notification to a specific role
 * @param {string} role 
 * @param {string} event 
 * @param {object} payload 
 */
function sendRoleNotification(role, event, payload) {
  if (!io) {
    console.warn('[Socket] ⚠️ Socket.io not initialized. Cannot send role notification.');
    return false;
  }

  const normalizedRole = role.toUpperCase();
  const roomName = `role:${normalizedRole}`;

  // Emit to specific event
  io.to(roomName).emit(event, {
    ...payload,
    timestamp: new Date().toISOString()
  });
  
  // Also emit to generic 'notification' event
  io.to(roomName).emit('notification', {
    ...payload,
    timestamp: new Date().toISOString()
  });
  
  return true;
}

module.exports = {
  init,
  sendWebNotification,
  sendRoleNotification
};
