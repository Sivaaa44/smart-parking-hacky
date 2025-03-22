const express = require('express');
const router = express.Router();
const reservationsController = require('../controllers/reservations.controller');
const auth = require('../middleware/auth');

// Get user's reservations
router.get('/user', auth, reservationsController.getUserReservations);

// Create reservation
router.post('/create', auth, reservationsController.createReservation);

// Cancel a reservation
router.post('/:id/cancel', auth, reservationsController.cancelReservation);

module.exports = router;
