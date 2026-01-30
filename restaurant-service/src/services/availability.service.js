const { getPool, sql } = require('../config/sql');

async function getAvailability(restaurantId, date) {
  // placeholder: should query Tables + Bookings
  return { available: true };
}

module.exports = { getAvailability };
