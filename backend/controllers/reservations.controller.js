const Reservation = require('../models/Reservation');
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const moment = require('moment');

// Define isTimeSlotAvailable BEFORE the controller object
// Make it a standalone function
async function isTimeSlotAvailable(parkingLotId, startTime, endTime, excludeReservationId = null) {
  try {
    // Parse the times to ensure they're Date objects
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Find the parking lot
    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot) {
      throw new Error('Parking lot not found');
    }
    
    // Create a query to find overlapping reservations
    const query = {
      parkingLot: parkingLotId,
      status: { $in: ['pending', 'confirmed'] }, // Only check active reservations
      $or: [
        // Case 1: New reservation starts during an existing reservation
        { startTime: { $lte: start }, endTime: { $gt: start } },
        // Case 2: New reservation ends during an existing reservation
        { startTime: { $lt: end }, endTime: { $gte: end } },
        // Case 3: New reservation completely contains an existing reservation
        { startTime: { $gte: start }, endTime: { $lte: end } }
      ]
    };
    
    // If we're updating an existing reservation, exclude it from the check
    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }
    
    // Count overlapping reservations with a single query
    const overlappingReservationsCount = await Reservation.countDocuments(query);
    
    // Check if there are enough spots available at that time
    const spotsAvailableAtTime = parkingLot.totalSpots - overlappingReservationsCount;
    
    return spotsAvailableAtTime > 0;
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    throw error;
  }
}

const reservationsController = {
  // Create a new reservation
  async createReservation(req, res) {
    try {
      const { parkingLotId, vehicleType, vehicleNumber, startTime, endTime } = req.body;
      const userId = req.user._id;
      
      // Validate input
      if (!parkingLotId || !vehicleType || !vehicleNumber) {
        return res.status(400).json({
          message: 'Missing required reservation data'
        });
      }
      
      let parsedStartTime, parsedEndTime;
      
      // If no times provided, default to next available hour slot
      if (!startTime || !endTime) {
        parsedStartTime = moment().startOf('hour').add(1, 'hour').toDate();
        parsedEndTime = moment(parsedStartTime).add(1, 'hour').toDate();
      } else {
        parsedStartTime = moment(startTime).toDate();
        parsedEndTime = moment(endTime).toDate();
      }
      
      // Validate times
      if (moment(parsedStartTime).isBefore(moment())) {
        return res.status(400).json({
          message: 'Cannot book slots in the past'
        });
      }
      
      // Validate booking time window (e.g., only allow booking up to 24 hours in advance)
      const maxBookingWindow = moment().add(24, 'hours');
      if (moment(parsedStartTime).isAfter(maxBookingWindow)) {
        return res.status(400).json({
          message: 'Cannot book slots more than 24 hours in advance'
        });
      }
      
      // Check if lot exists
      const lot = await ParkingLot.findById(parkingLotId);
      if (!lot) {
        return res.status(404).json({
          message: 'Parking lot not found'
        });
      }
      
      if (!lot.isOpen) {
        return res.status(400).json({
          message: 'Parking lot is currently closed'
        });
      }
      
      // Use the standalone function instead of this.isTimeSlotAvailable
      const isAvailable = await isTimeSlotAvailable(
        parkingLotId, 
        parsedStartTime, 
        parsedEndTime
      );
      
      if (!isAvailable) {
        return res.status(400).json({
          message: 'No parking spots available for the selected time period'
        });
      }
      
      // Calculate cost based on rates and duration
      const durationHours = moment(parsedEndTime).diff(moment(parsedStartTime), 'hours', true);
      
      // Get the appropriate rate based on vehicle type
      const rate = lot.rates[vehicleType]?.hourly || lot.rates.standard?.hourly;
      if (!rate) {
        return res.status(400).json({
          message: `No rates defined for ${vehicleType}`
        });
      }
      
      const amount = Math.ceil(durationHours * rate);
      
      // Create the reservation
      const reservation = new Reservation({
        user: userId,
        parkingLot: parkingLotId,
        vehicleType,
        vehicleNumber,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        amount,
        status: 'confirmed',
        paymentStatus: 'pending'
      });
      
      await reservation.save();
      
      // Update parking lot real-time availability (for current time only)
      const now = moment();
      if (moment(parsedStartTime).isSameOrBefore(now) && moment(parsedEndTime).isAfter(now)) {
        lot.availableSpots = Math.max(0, lot.availableSpots - 1);
        await lot.save();
      }
      
      // Emit socket event
      const io = req.app.get('io');
      if (io) {
        io.to(`lot-${lot._id}`).emit('availability-update', {
          lotId: lot._id,
          availableSpots: lot.availableSpots
        });
      }
      
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

  // Get all reservations for a user
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

  // Cancel a reservation
  async cancelReservation(req, res) {
    try {
      const reservationId = req.params.id;
      const userId = req.user._id;
      
      const reservation = await Reservation.findOne({
        _id: reservationId,
        user: userId,
        status: { $in: ['pending', 'confirmed'] }
      });
      
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Active reservation not found'
        });
      }
      
      reservation.status = 'cancelled';
      await reservation.save();
      
      // Update parking lot availability
      const lot = await ParkingLot.findById(reservation.parkingLot);
      lot.availableSpots += 1;
      await lot.save();
      
      // Update slot
      const slot = await ParkingSlot.findById(reservation.parkingSlot);
      if (slot) {
        slot.isOccupied = false;
        slot.currentReservation = null;
        await slot.save();
      }
      
      // Emit availability update via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`lot-${lot._id}`).emit('availability-update', {
          lotId: lot._id,
          availableSpots: lot.availableSpots
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
  
  // Socket handler (special method for socket-based reservation creation)
  async createReservationSocket(data) {
    try {
      const { userId, lotId, vehicleType, vehicleNumber, startTime, endTime } = data;
      
      // Perform validation and creation (similar to createReservation)
      // ... (same validation logic as above)
      
      // Check if lot exists and has availability
      const lot = await ParkingLot.findById(lotId);
      if (!lot) {
        throw new Error('Parking lot not found');
      }
      
      if (!lot.isOpen) {
        throw new Error('Parking lot is currently closed');
      }
      
      if (lot.availableSpots <= 0) {
        throw new Error('No spots available in this parking lot');
      }
      
      // Find available slot
      const slots = await ParkingSlot.find({ parkingLot: lotId });
      let availableSlot = null;
      
      for (const slot of slots) {
        if (await slot.isAvailableForPeriod(startTime, endTime)) {
          availableSlot = slot;
          break;
        }
      }
      
      if (!availableSlot) {
        throw new Error('No slots available for the requested time period');
      }
      
      // Calculate cost
      const durationHours = moment(endTime).diff(moment(startTime), 'hours', true);
      const rate = lot.rates[vehicleType]?.hourly || 50;
      const amount = Math.ceil(durationHours * rate);
      
      // Create the reservation
      const reservation = new Reservation({
        user: userId,
        parkingLot: lotId,
        parkingSlot: availableSlot._id,
        vehicleType,
        vehicleNumber,
        startTime,
        endTime,
        amount,
        status: 'pending',
        paymentStatus: 'pending'
      });
      
      await reservation.save();
      
      // Update parking lot availability
      lot.availableSpots -= 1;
      await lot.save();
      
      // Update slot
      availableSlot.currentReservation = reservation._id;
      availableSlot.isOccupied = true;
      await availableSlot.save();
      
      return {
        reservation,
        updatedAvailability: lot.availableSpots
      };
    } catch (error) {
      console.error('Create reservation socket error:', error);
      throw error;
    }
  }
};

// Export both the controller and the utility function
module.exports = {
  ...reservationsController,
  isTimeSlotAvailable
}; 