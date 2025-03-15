const express = require('express');
const router = express.Router();
const parkingLotsController = require('../controllers/parkingLots.controller');
const auth = require('../middleware/auth');

// Static routes first
router.get('/statistics', auth, parkingLotsController.getStatistics);
router.get('/nearby', auth, parkingLotsController.getNearby);

// User reservations
router.get('/reservations/user', auth, parkingLotsController.getUserReservations);
router.post('/reservations/:reservationId/cancel', auth, parkingLotsController.cancelReservation);

// Dynamic routes with IDs lasthttp://localhost:5000/api/parking-lots/67d53907e4da2325de0144f0/reserve
router.get('/:id', auth, parkingLotsController.getOne);
router.get('/:id/available-slots', auth, parkingLotsController.getAvailableSlots);
router.post('/:id/reserve', auth, parkingLotsController.createReservation);
router.post('/:id/simulate', auth, parkingLotsController.simulate);
router.get('/:id/available-time-slots', auth, parkingLotsController.getAvailableTimeSlots);

module.exports = router; 