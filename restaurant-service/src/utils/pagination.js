/**
 * pagination.js - simple pagination helper (placeholder)
 */
function paginate(query, { page = 1, perPage = 20 } = {}) {
  const skip = (page - 1) * perPage;
  return { skip, limit: perPage };
}

module.exports = { paginate };
