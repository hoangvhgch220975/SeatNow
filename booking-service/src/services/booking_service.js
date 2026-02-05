/**
 * booking.service.js - core booking rules (placeholder)
 */
const lock = require('../utils/lock.redis');

async function createBooking(payload) {
  // Acquire lock per resource (e.g., table/restaurant) then insert booking in SQL
  // Placeholder: return echo
  return { created: true, payload };
}

async function cancelBooking(id) {
  // Placeholder cancel logic
  return { cancelled: true, id };
}

module.exports = { createBooking, cancelBooking };
