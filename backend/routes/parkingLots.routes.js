const express = require('express');
const router = express.Router();
const parkingLotsController = require('../controllers/parkingLots.controller');
const auth = require('../middleware/auth');
const ParkingLot = require('../models/ParkingLot');

// Static routes first
router.get('/statistics', auth, parkingLotsController.getStatistics);
router.get('/nearby', auth, parkingLotsController.getNearby);
router.get('/find-by-destination', auth, parkingLotsController.findByDestination);

// User reservations
router.get('/reservations/user', auth, parkingLotsController.getUserReservations);
router.post('/reservations/:reservationId/cancel', auth, parkingLotsController.cancelReservation);

// Dynamic routes with IDs
router.get('/:id', auth, parkingLotsController.getOne);
router.get('/:id/available-slots', auth, parkingLotsController.getAvailableSlots);
router.get('/:id/availability', auth, parkingLotsController.getLotAvailability);
router.get('/:id/available-time-slots', auth, parkingLotsController.getAvailableTimeSlots);
router.post('/:id/reserve', auth, parkingLotsController.createReservation);
router.post('/:id/simulate', auth, parkingLotsController.simulate);

// Get parking lots within radius (in kilometers)
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    
    const parkingLots = await ParkingLot.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      }
    });
    
    res.json(parkingLots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get real-time availability
router.get('/:id/availability', async (req, res) => {
  try {
    const lot = await ParkingLot.findById(req.params.id)
      .select('availableSpots totalSpots');
    res.json(lot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 