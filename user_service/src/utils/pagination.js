function getPagination(q = {}) {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '10', 10), 1), 50);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { getPagination };
