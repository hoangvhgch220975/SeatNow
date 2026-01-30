const MenuItem = require('../models/menuItem.mongo');

async function listMenu(restaurantId) {
  return MenuItem.find({ restaurantId }).lean();
}

module.exports = { listMenu };
