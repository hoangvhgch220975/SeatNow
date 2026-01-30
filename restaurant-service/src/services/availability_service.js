/**
 * availability.service (placeholder)
 * Should compute available tables for a restaurant and date/time.
 */
const { getPool } = require('../config/sql');

async function getAvailability(restaurantId, date) {
  // placeholder implementation
  return { available: true };
}

module.exports = { getAvailability };
