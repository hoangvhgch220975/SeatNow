/**
 * menu.service (placeholder)
 */
const MenuItem = require('../models/menuItem_mongo');

async function listMenu(restaurantId) {
  return MenuItem.find({ restaurantId }).lean();
}

module.exports = { listMenu };
