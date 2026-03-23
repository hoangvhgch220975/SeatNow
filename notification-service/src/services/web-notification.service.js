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
      // Join a room specific to this user/restaurant owner
      socket.join(`user:${userId}`);
      console.log(`Socket connected: User ${userId} (${role}) joined room user:${userId}`);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: User ${userId}`);
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

module.exports = {
  init,
  sendWebNotification
};
