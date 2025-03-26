const Reservation = require('../models/Reservation');
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const dateUtils = require('../utils/dateUtils');

/**
 * Helper function to check if a time slot is available
 * @param {string} parkingLotId - The ID of the parking lot
 * @param {Date|string} startTime - The start time
 * @param {Date|string} endTime - The end time
 * @param {string} excludeReservationId - Optional reservation ID to exclude from check
 * @returns {Promise<boolean>} - Whether the time slot is available
 */
async function isTimeSlotAvailable(parkingLotId, startTime, endTime, excludeReservationId = null) {
  try {
    // Parse dates
    const start = dateUtils.parseDate(startTime);
    const end = dateUtils.parseDate(endTime);

    // Validate time range
    if (end <= start) {
      throw new Error('End time must be after start time');
    }

    // Find the parking lot
    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot) {
      throw new Error('Parking lot not found');
    }

    // Query for overlapping reservations
    const query = {
      parkingLot: parkingLotId,
      status: { $in: ['pending', 'confirmed'] },
      startTime: { $lt: end },
      endTime: { $gt: start }
    };

    // Exclude specified reservation if provided
    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }

    // Count overlapping reservations
    const overlappingReservationsCount = await Reservation.countDocuments(query);

    // Check if spots are available
    return (parkingLot.totalSpots - overlappingReservationsCount) > 0;
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    throw error;
  }
}

/**
 * Helper function to update availability via socket
 * @param {Object} io - Socket.io instance
 * @param {Object} lot - The parking lot document
 * @param {Object} reservationDetails - Details about reservation times and availability
 * @param {boolean} wasError - Whether there was an error
 */
async function updateAvailabilityViaSocket(io, lot, reservationDetails = null, wasError = false) {
  if (!io) return;

  try {
    // Ensure lot has updated availability
    await lot.calculateAvailableSpots();

    // Prepare socket data
    const updateData = {
      lotId: lot._id,
      currentAvailableSpots: lot.availableSpots,
      wasError
    };

    // Add reservation details if provided
    if (reservationDetails) {
      updateData.reservationDetails = reservationDetails;
    }

    // Emit to room for this specific lot
    io.to(`lot-${lot._id}`).emit('availability-update', updateData);

    // Emit to all clients for map updates
    io.emit('map-availability-update', {
      lotId: lot._id,
      availableSpots: lot.availableSpots,
      wasError
    });
  } catch (error) {
    console.error('Error updating availability via socket:', error);
  }
}

// Add this function to the controller
async function createReservationSocket(data) {
  try {
    // Extract necessary data
    const { userId, parkingLotId, vehicleType, vehicleNumber, startTime, endTime } = data;

    if (!userId || !parkingLotId || !vehicleType || !vehicleNumber || !startTime || !endTime) {
      throw new Error('Missing required reservation data');
    }

    // Parse and validate dates
    const parsedStartTime = dateUtils.parseDate(startTime);
    const parsedEndTime = dateUtils.parseDate(endTime);

    // Validate time range and other conditions (similar to createReservation)
    const now = new Date();

    if (parsedStartTime <= now) {
      throw new Error('Start time must be in the future');
    }

    if (parsedEndTime <= parsedStartTime) {
      throw new Error('End time must be after start time');
    }

    // Check if parking lot exists
    const lot = await ParkingLot.findById(parkingLotId);
    if (!lot) {
      throw new Error('Parking lot not found');
    }

    if (!lot.isOpen) {
      throw new Error('Parking lot is currently closed');
    }

    // Check availability for the requested time
    const isAvailable = await isTimeSlotAvailable(parkingLotId, parsedStartTime, parsedEndTime);
    if (!isAvailable) {
      throw new Error('No parking spots available for the selected time period');
    }

    // Calculate cost
    const durationHours = dateUtils.getDurationHours(parsedStartTime, parsedEndTime);
    const rate = lot.rates[vehicleType]?.hourly || lot.rates.standard?.hourly || 50;
    const amount = Math.ceil(durationHours * rate);

    // Create the reservation
    const reservation = new Reservation({
      user: userId,
      parkingLot: parkingLotId,
      vehicleType,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      amount,
      status: 'confirmed',
      paymentStatus: 'pending'
    });

    await reservation.save();

    // Update lot's availability
    await lot.calculateAvailableSpots();

    // Get the future availability for this time slot
    const futureAvailability = await lot.getAvailabilityForTime(parsedStartTime, parsedEndTime);

    return {
      reservation,
      updatedAvailability: lot.availableSpots,
      futureAvailability,
      startTime: parsedStartTime,
      endTime: parsedEndTime
    };
  } catch (error) {
    console.error('Create reservation socket error:', error);
    throw error;
  }
}

const reservationsController = {
  /**
   * Create a new reservation
   */
  async createReservation(req, res) {
    try {
      const { parkingLotId, vehicleType, vehicleNumber, startTime } = req.body;
      const userId = req.user._id;

      // Validate basic inputs
      if (!parkingLotId || !vehicleType || !vehicleNumber || !startTime) {
        return res.status(400).json({
          success: false,
          message: 'Missing required reservation data'
        });
      }

      const parkingLot = await ParkingLot.findById(parkingLotId);
      if (!parkingLot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }

      // Create an open-ended reservation
      const reservation = new Reservation({
        user: userId,
        parkingLot: parkingLotId,
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        startTime: new Date(startTime),
        status: 'active',
        paymentStatus: 'pending'
      });

      await reservation.save();

      res.status(201).json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Create reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating reservation',
        error: error.message
      });
    }
  },

  /**
   * Get all reservations for the logged-in user
   */
  async getUserReservations(req, res) {
    try {
      const userId = req.user._id;

      const reservations = await Reservation.find({ user: userId })
        .populate('parkingLot', 'name address rates')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: reservations
      });
    } catch (error) {
      console.error('Get user reservations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching reservations',
        error: error.message
      });
    }
  },

  /**
   * Cancel an existing reservation
   */
  async cancelReservation(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const reservation = await Reservation.findOne({
        _id: id,
        user: userId,
        status: { $in: ['pending', 'confirmed'] }
      });

      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Active reservation not found'
        });
      }

      // Update reservation status
      reservation.status = 'cancelled';
      await reservation.save();

      // Get parking lot
      const lot = await ParkingLot.findById(reservation.parkingLot);
      if (!lot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }

      // Update lot's availability
      await lot.calculateAvailableSpots();

      // Emit availability update via socket
      const io = req.app.get('io');
      if (io) {
        // Get the future availability for this time slot
        const futureAvailability = await lot.getAvailabilityForTime(
          reservation.startTime,
          reservation.endTime
        );

        await updateAvailabilityViaSocket(io, lot, {
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          availableSpotsForThisTime: futureAvailability,
          wasCancelled: true
        });
      }

      res.json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Cancel reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling reservation',
        error: error.message
      });
    }
  },

  // Add endpoint to end parking session
  async endParkingSession(req, res) {
    try {
      const { reservationId } = req.params;
      const endTime = new Date();

      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reservation not found'
        });
      }

      const parkingLot = await ParkingLot.findById(reservation.parkingLot);
      
      // Calculate final fee
      const finalFee = parkingLot.calculateParkingFee(reservation.startTime, endTime);
      
      // Update reservation
      reservation.endTime = endTime;
      reservation.amount = finalFee;
      reservation.status = 'completed';
      await reservation.save();

      res.json({
        success: true,
        data: {
          reservation,
          parkingDuration: dateUtils.formatDuration(reservation.startTime, endTime),
          finalFee
        }
      });
    } catch (error) {
      console.error('End parking session error:', error);
      res.status(500).json({
        success: false,
        message: 'Error ending parking session',
        error: error.message
      });
    }
  },
};


// Export controller and helper functions
module.exports = {
  ...reservationsController,
  isTimeSlotAvailable,
  updateAvailabilityViaSocket,
  createReservationSocket
}; 