const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');

router.get('/stats', controller.getStats);

module.exports = router;
