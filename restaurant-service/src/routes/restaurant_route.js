/**
 * restaurant.route - placeholder routes
 */
const express = require('express');
const router = express.Router();
const restaurantCtrl = require('../controllers/restaurant_controller');
const menuCtrl = require('../controllers/menu_controller');
const reviewCtrl = require('../controllers/review_controller');

router.get('/', (req, res) => res.json({ msg: 'restaurants root' }));
router.get('/:id', restaurantCtrl.getRestaurant);
router.get('/:id/menu', menuCtrl.listMenu);
router.post('/:id/reviews', reviewCtrl.createReview);

module.exports = router;
