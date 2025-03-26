const express = require('express');
const router = express.Router();
const parkingLotsController = require('../controllers/parkingLots.controller');
const auth = require('../middleware/auth');


router.get('/nearby', auth, parkingLotsController.getNearby);
router.get('/:id', auth, parkingLotsController.getOne);
router.get('/:id/availability', auth, parkingLotsController.getLotAvailability);
router.get('/:id/available-time-slots', auth, parkingLotsController.getAvailableTimeSlots);
router.get('/:id/check-availability', auth, parkingLotsController.checkAvailabilityForTime);


module.exports = router; 