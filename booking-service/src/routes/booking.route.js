const express = require('express');
const router = express.Router();
const controller = require('../controllers/booking.controller');

router.post('/', controller.createBooking);
router.post('/:id/cancel', controller.cancelBooking);

module.exports = router;
