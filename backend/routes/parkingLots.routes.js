const express = require('express');
const router = express.Router();
const parkingLotsController = require('../controllers/parkingLots.controller');
const auth = require('../middleware/auth');

router.get('/nearby', auth, parkingLotsController.getNearby);
router.get('/:id', auth, parkingLotsController.getOne);
router.post('/:id/simulate', auth, parkingLotsController.simulate);
router.get('/statistics', auth, parkingLotsController.getStatistics);

module.exports = router; 