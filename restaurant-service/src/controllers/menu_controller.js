/**
 * menu.controller (placeholder)
 */
const menuService = require('../services/menu.service');

async function listMenu(req, res, next) {
  try {
    const restaurantId = req.params.id;
    const items = await menuService.listMenu(restaurantId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMenu };
