/**
 * booking.socket.js - socket helpers (placeholder)
 */
module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log('booking socket connected', socket.id);
  });
};
