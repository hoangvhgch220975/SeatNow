/**
 * pagination.js - simple pagination helper (placeholder)
 */
function normalizePaging(q) {
  const limit = Math.min(Math.max(parseInt(q.limit || 20, 10), 1), 50);
  const offset = Math.max(parseInt(q.offset || 0, 10), 0);
  return { limit, offset };
}
module.exports = { normalizePaging };

