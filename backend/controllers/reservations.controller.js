const Reservation = require('../models/Reservation');
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const moment = require('moment');
const dateUtils = require('../utils/dateUtils');

// Define isTimeSlotAvailable BEFORE the controller object
// Make it a standalone function
// Add this helper function at the top
const updateAvailabilityViaSocket = async (io, lot, startTime, endTime, availableSpots, wasError = false) => {
  if (!io) return;
  
  try {
    // Get current overlapping reservations
    const now = new Date();
    const currentQuery = {
      parkingLot: lot._id,
      status: { $in: ['pending', 'confirmed'] },
      startTime: { $lte: now },
      endTime: { $gt: now }
    };
    
    const currentOverlappingCount = await Reservation.countDocuments(currentQuery);
    const currentAvailableSpots = Math.max(0, lot.totalSpots - currentOverlappingCount);
    
    // Update lot's current availability if needed
    if (lot.availableSpots !== currentAvailableSpots) {
      lot.availableSpots = currentAvailableSpots;
      await lot.save();
    }
    
    // Emit the update with complete information
    io.to(`lot-${lot._id}`).emit('availability-update', {
      lotId: lot._id,
      currentAvailableSpots: currentAvailableSpots,
      wasError,
      reservationDetails: {
        startTime,
        endTime,
        availableSpotsForThisTime: availableSpots
      }
    });
    
    // Only emit map update if current availability changed
    io.emit('map-availability-update', {
      lotId: lot._id,
      availableSpots: currentAvailableSpots,
      wasError
    });
  } catch (error) {
    console.error('Error updating availability via socket:', error);
  }
};

const validateReservationRequest = async (parkingLotId, startTime, endTime) => {
  const lot = await ParkingLot.findById(parkingLotId);
  if (!lot) {
    throw new Error('Parking lot not found');
  }
  
  if (!lot.isOpen) {
    throw new Error('Parking lot is currently closed');
  }
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const now = new Date();
  
  if (start < now) {
    throw new Error('Cannot book slots in the past');
  }
  
  if (end <= start) {
    throw new Error('End time must be after start time');
  }
  
  const query = {
    parkingLot: parkingLotId,
    status: { $in: ['pending', 'confirmed'] },
    startTime: { $lt: end },
    endTime: { $gt: start }
  };
  
  const overlappingReservationsCount = await Reservation.countDocuments(query);
  const spotsAvailableAtTime = lot.totalSpots - overlappingReservationsCount;
  
  if (spotsAvailableAtTime <= 0) {
    throw new Error('No spots available for the selected time period');
  }
  
  return {
    lot,
    spotsAvailableAtTime,
    overlappingReservationsCount
  };
};

async function isTimeSlotAvailable(parkingLotId, startTime, endTime, excludeReservationId = null) {
  try {
    // Ensure proper timezone handling for IST
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Log times for debugging
    console.log('Checking time slot availability:', {
      requestedStartTime: start.toISOString(),
      requestedEndTime: end.toISOString(),
      requestedStartTimeIST: start.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}),
      requestedEndTimeIST: end.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
    });
    
    // Additional validation
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid start or end time provided');
    }
    
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
    
    // Exclude current reservation if updating
    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }
    
    // Count overlapping reservations and log them
    const overlappingReservations = await Reservation.find(query);
    const overlappingReservationsCount = overlappingReservations.length;
    
    // Log overlapping reservations for debugging
    if (overlappingReservationsCount > 0) {
      console.log('Found overlapping reservations:', 
        overlappingReservations.map(r => ({
          id: r._id,
          start: new Date(r.startTime).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}),
          end: new Date(r.endTime).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
        }))
      );
    }
    
    // Calculate available spots during requested time
    const availableSpotsAtTime = parkingLot.totalSpots - overlappingReservationsCount;
    
    return availableSpotsAtTime > 0;
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
      
      // Log the request data for debugging
      console.log('Create reservation request:', {
        parkingLotId,
        vehicleType,
        vehicleNumber,
        startTime,
        endTime
      });
      
      // Validate input
      if (!parkingLotId || !vehicleType || !vehicleNumber) {
        return res.status(400).json({
          success: false,
          message: 'Missing required reservation data'
        });
      }
      
      // Parse dates with IST consideration
      let parsedStartTime = startTime ? new Date(startTime) : null;
      let parsedEndTime = endTime ? new Date(endTime) : null;
      
      // Log the parsed times
      console.log('Parsed times:', {
        parsedStartTime: parsedStartTime?.toISOString(),
        parsedEndTime: parsedEndTime?.toISOString(),
        parsedStartTimeIST: parsedStartTime?.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}),
        parsedEndTimeIST: parsedEndTime?.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
      });
      
      // If no times provided, default to next hour
      if (!parsedStartTime || !parsedEndTime) {
        // Create date with IST offset
        const now = new Date();
        const istOffset = 330; // 5 hours 30 minutes in minutes
        const nowIST = new Date(now.getTime() + (istOffset * 60000));
        
        // Round to next hour in IST
        nowIST.setHours(nowIST.getHours() + 1);
        nowIST.setMinutes(0, 0, 0);
        
        parsedStartTime = nowIST;
        parsedEndTime = new Date(parsedStartTime);
        parsedEndTime.setHours(parsedEndTime.getHours() + 1);
        
        console.log('Default times calculated:', {
          parsedStartTime: parsedStartTime.toISOString(),
          parsedEndTime: parsedEndTime.toISOString(),
          parsedStartTimeIST: parsedStartTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}),
          parsedEndTimeIST: parsedEndTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
        });
      }
      
      // Validate start time is in the future
      const now = new Date();
      if (parsedStartTime <= now) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be in the future'
        });
      }
      
      // Validate end time is after start time
      if (parsedEndTime <= parsedStartTime) {
        return res.status(400).json({
          success: false,
          message: 'End time must be after start time'
        });
      }
      
      // Validate booking window (max 24 hours in advance)
      const maxBookingTime = new Date(now);
      maxBookingTime.setHours(maxBookingTime.getHours() + 24);
      if (parsedStartTime > maxBookingTime) {
        return res.status(400).json({
          success: false,
          message: 'Cannot book slots more than 24 hours in advance'
        });
      }
      
      // Check if lot exists
      const lot = await ParkingLot.findById(parkingLotId);
      if (!lot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }
      
      if (!lot.isOpen) {
        return res.status(400).json({
          success: false,
          message: 'Parking lot is currently closed'
        });
      }
      
      // Get overlapping reservations for requested time
      const query = {
        parkingLot: parkingLotId,
        status: { $in: ['pending', 'confirmed'] },
        startTime: { $lt: parsedEndTime },
        endTime: { $gt: parsedStartTime }
      };
      
      const overlappingReservationsCount = await Reservation.countDocuments(query);
      const spotsAvailableForRequestedTime = lot.totalSpots - overlappingReservationsCount;
      
      if (spotsAvailableForRequestedTime <= 0) {
        return res.status(400).json({
          success: false,
          message: 'No parking spots available for the selected time period'
        });
      }
      
      // Calculate cost
      const durationHours = (parsedEndTime - parsedStartTime) / (1000 * 60 * 60);
      const rate = lot.rates[vehicleType]?.hourly || lot.rates.standard?.hourly || 50;
      const amount = Math.ceil(durationHours * rate);
      
      // Check if reservation affects current availability
      const isCurrentReservation = parsedStartTime <= now && parsedEndTime > now;
      
      // Only decrement current available spots if the reservation is for current time
      if (isCurrentReservation) {
        lot.availableSpots = Math.max(0, lot.availableSpots - 1);
        await lot.save();
      }
      
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
      
      // Update available spots via socket
      const io = req.app.get('io');
      if (io) {
        // Get current availability for this lot (after this reservation)
        const currentQuery = {
          parkingLot: parkingLotId,
          status: { $in: ['pending', 'confirmed'] },
          startTime: { $lte: now },
          endTime: { $gt: now }
        };
        
        const currentReservationsCount = await Reservation.countDocuments(currentQuery);
        const currentlyAvailableSpots = Math.max(0, lot.totalSpots - currentReservationsCount);
        
        // Update lot's available spots to match current reality if needed
        if (lot.availableSpots !== currentlyAvailableSpots) {
          lot.availableSpots = currentlyAvailableSpots;
          await lot.save();
        }
        
        // Emit time-specific and current availability
        io.to(`lot-${lot._id}`).emit('availability-update', {
          lotId: lot._id,
          currentAvailableSpots: currentlyAvailableSpots,
          wasError: false,
          reservationDetails: {
            startTime: parsedStartTime,
            endTime: parsedEndTime,
            // Adjust by 1 to account for new reservation
            availableSpotsForThisTime: spotsAvailableForRequestedTime - 1
          }
        });
        
        // Also update the map view
        io.emit('map-availability-update', {
          lotId: lot._id,
          availableSpots: currentlyAvailableSpots,
          wasError: false
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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      
      // Save old status for tracking
      const oldStatus = reservation.status;
      
      // Update reservation status
      reservation.status = 'cancelled';
      await reservation.save();
      
      // Get the parking lot
      const lot = await ParkingLot.findById(reservation.parkingLot);
      
      // Only increment availableSpots if this reservation is currently active
      // i.e., it's happening right now
      const now = new Date();
      if (reservation.startTime <= now && reservation.endTime > now) {
        lot.availableSpots = Math.min(lot.totalSpots, lot.availableSpots + 1);
        await lot.save();
      } else {
        // Recalculate current availability to be sure
        await lot.updateAvailableSpots();
      }
      
      // Update slot if assigned
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
          availableSpots: lot.availableSpots,
          wasCancelled: true,
          forTime: {
            start: reservation.startTime,
            end: reservation.endTime
          }
        });
        
        io.emit('map-availability-update', {
          lotId: lot._id,
          availableSpots: lot.availableSpots,
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
  
  // Socket handler (special method for socket-based reservation creation)
  async createReservationSocket(data) {
    try {
      const { userId, lotId, vehicleType, vehicleNumber, startTime, endTime } = data;
      if (!lotId || !vehicleType || !vehicleNumber) {
        return res.status(400).json({
          message: 'Missing required reservation data'
        });
      }
      
      let parsedStartTime, parsedEndTime;
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
      const lott = await ParkingLot.findById(lotId);
      if (!lott) {
        return res.status(404).json({
          message: 'Parking lot not found'
        });
      }
      
      if (!lott.isOpen) {
        return res.status(400).json({
          message: 'Parking lot is currently closed'
        });
      }
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
        if (await slot.isAvailableForPeriod(parsedStartTime, parsedEndTime)) {
          availableSlot = slot;
          break;
        }
      }
      
      if (!availableSlot) {
        throw new Error('No slots available for the requested time period');
      }
      
      // Calculate cost
      const durationHours = moment(parsedEndTime).diff(moment(parsedStartTime), 'hours', true);
      const rate = lot.rates[vehicleType]?.hourly || 50;
      const amount = Math.ceil(durationHours * rate);
      
      // If this reservation affects current availability, update the count
      const now = new Date();
      if (parsedStartTime <= now && parsedEndTime > now) {
        lot.availableSpots = Math.max(0, lot.availableSpots - 1);
      } else {
        // Otherwise recalculate to be sure
        await lot.calculateAvailableSpots();
      }
      await lot.save();
      
      // Create the reservation
      const reservation = new Reservation({
        user: userId,
        parkingLot: lotId,
        parkingSlot: availableSlot._id,
        vehicleType,
        vehicleNumber,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        amount,
        status: 'pending',
        paymentStatus: 'pending'
      });
      
      await reservation.save();
      
      // Update slot
      availableSlot.currentReservation = reservation._id;
      availableSlot.isOccupied = true;
      await availableSlot.save();
      
      return {
        reservation,
        updatedAvailability: lot.availableSpots,
        isCurrentReservation: parsedStartTime <= now && parsedEndTime > now
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