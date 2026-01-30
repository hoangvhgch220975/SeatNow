/**
 * restaurant.controller (placeholder)
 */
const restaurantService = require('../services/restaurant.service');

async function getRestaurant(req, res, next) {
  try {
    const id = req.params.id;
    const data = await restaurantService.getRestaurantById(id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getRestaurant };
