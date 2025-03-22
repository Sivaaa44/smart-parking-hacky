const express = require('express');
const router = express.Router();
const parkingLotsController = require('../controllers/parkingLots.controller');
const auth = require('../middleware/auth');
const ParkingLot = require('../models/ParkingLot');
const Reservation = require('../models/Reservation');

// Static routes first
router.get('/statistics', auth, parkingLotsController.getStatistics);
router.get('/nearby', auth, parkingLotsController.getNearby);
router.get('/find-by-destination', auth, parkingLotsController.findByDestination);

// Dynamic routes with IDs
router.get('/:id', auth, parkingLotsController.getOne);
router.get('/:id/available-slots', auth, parkingLotsController.getAvailableSlots);
router.get('/:id/availability', auth, parkingLotsController.getLotAvailability);
router.get('/:id/available-time-slots', auth, parkingLotsController.getAvailableTimeSlots);
router.post('/:id/simulate', auth, parkingLotsController.simulate);
router.get('/:id/check-availability', auth, parkingLotsController.checkAvailabilityForTime);


module.exports = router; 