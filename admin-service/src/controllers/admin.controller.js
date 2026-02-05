/**
 * admin.controller.js - HTTP handlers (placeholder)
 */
const adminService = require('../services/admin.service');

async function getStats(req, res) {
  const stats = await adminService.getStats();
  res.json(stats);
}

module.exports = { getStats };
