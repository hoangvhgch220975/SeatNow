/**
 * booking.controller.js - HTTP handlers (placeholder)
 */
const bookingService = require('../services/booking.service');

async function createBooking(req, res) {
  const payload = req.body;
  const result = await bookingService.createBooking(payload);
  res.json(result);
}

async function cancelBooking(req, res) {
  const id = req.params.id;
  const result = await bookingService.cancelBooking(id);
  res.json(result);
}

module.exports = { createBooking, cancelBooking };
