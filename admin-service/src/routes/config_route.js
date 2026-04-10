const express = require('express');
const router = express.Router();
const configController = require('../controllers/config_controller');
// Placeholder for auth middleware if exists. Assuming it is handled in a central place or not required for now since it is admin-service.

router.get('/commission', configController.getCommissionConfig);
router.post('/commission', configController.updateCommissionConfig);

module.exports = router;
