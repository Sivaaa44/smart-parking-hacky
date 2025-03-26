const ParkingLot = require('../models/ParkingLot');
const Reservation = require('../models/Reservation');
const ParkingSlot = require('../models/ParkingSlot');
const dateUtils = require('../utils/dateUtils');

/**
 * Controller for parking lot operations
 * Optimized for consistency and clean code
 */
const parkingLotsController = {
  /**
   * Get nearby parking lots based on coordinates
   */
  async getNearby(req, res) {
    try {
      const { longitude, latitude, maxDistance = 2000000 } = req.query;

      // Validate coordinates
      if (!longitude || !latitude) {
        return res.status(400).json({ message: 'Both longitude and latitude are required' });
      }

      const parsedLong = parseFloat(longitude);
      const parsedLat = parseFloat(latitude);

      if (isNaN(parsedLong) || isNaN(parsedLat) ||
          parsedLong < -180 || parsedLong > 180 ||
          parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({ message: 'Invalid coordinates provided' });
      }

      const nearbyLots = await ParkingLot.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parsedLong, parsedLat]
            },
            $maxDistance: parseInt(maxDistance)
          }
        },
        isOpen: true
      }).select('-__v');

      // Refresh availability on query to ensure accurate data
      for (const lot of nearbyLots) {
        await lot.calculateAvailableSpots();
      }

      return res.json({ success: true, data: nearbyLots });
    } catch (error) {
      console.error('getNearby error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error finding nearby lots', 
        error: error.message 
      });
    }
  },

  /**
   * Get a specific parking lot by ID
   */
  async getOne(req, res) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid parking lot ID' 
        });
      }

      const lot = await ParkingLot.findById(id).select('-__v');
      if (!lot) {
        return res.status(404).json({ 
          success: false, 
          message: 'Parking lot not found' 
        });
      }
      
      // Update available spots to ensure fresh data
      await lot.calculateAvailableSpots();
      
      return res.json({ success: true, data: lot });
    } catch (error) {
      console.error('getOne error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error finding parking lot', 
        error: error.message 
      });
    }
  },

  /**
   * Check availability for a specific time slot
   */
  async checkAvailabilityForTime(req, res) {
    try {
      const { id } = req.params;
      const { startTime, endTime } = req.query;
      
      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Both startTime and endTime are required'
        });
      }
      
      // Parse and validate dates
      let start, end;
      try {
        start = dateUtils.parseDate(startTime);
        end = dateUtils.parseDate(endTime);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'End time must be after start time'
        });
      }
      
      // Find the parking lot
      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }
      
      // Get current time availability
      const now = new Date();
      await parkingLot.calculateAvailableSpots();
      
      // Get specific time availability
      const availableForRequestedTime = await parkingLot.getAvailabilityForTime(start, end);
      
      // Get reservations for the requested time period (for debugging)
      const overlappingReservations = await Reservation.find({
        parkingLot: id,
        status: { $in: ['pending', 'confirmed'] },
        startTime: { $lt: end },
        endTime: { $gt: start }
      }).select('startTime endTime status');
      
      return res.json({
        success: true,
        data: {
          parkingLotId: id,
          totalSpots: parkingLot.totalSpots,
          requestedTimeRange: {
            start: start.toISOString(),
            end: end.toISOString(),
            startIST: dateUtils.formatToIST(start),
            endIST: dateUtils.formatToIST(end)
          },
          currentTime: now.toISOString(),
          currentTimeIST: dateUtils.formatToIST(now),
          currentlyAvailableSpots: parkingLot.availableSpots,
          requestedTimeReservations: overlappingReservations.length,
          availableSpots: availableForRequestedTime,
          isAvailable: availableForRequestedTime > 0
        }
      });
    } catch (error) {
      console.error('Check availability error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking availability',
        error: error.message
      });
    }
  },

  /**
   * Get parking lot availability
   */
  async getLotAvailability(req, res) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid parking lot ID' 
        });
      }

      const lot = await ParkingLot.findById(id)
        .select('name availableSpots totalSpots types rates');
      
      if (!lot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }
      
      // Update available spots to ensure accuracy
      await lot.calculateAvailableSpots();

      return res.json({
        success: true,
        data: {
          id: lot._id,
          name: lot.name,
          availableSpots: lot.availableSpots,
          totalSpots: lot.totalSpots,
          types: lot.types,
          rates: lot.rates
        }
      });
    } catch (error) {
      console.error('getLotAvailability error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching lot availability',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },
  
  /**
   * Get available time slots for a parking lot on a specific date
   */
  async getAvailableTimeSlots(req, res) {
    try {
      const { id } = req.params;
      const { date } = req.query;
      
      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }

      // Get all active reservations for this date range
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const reservations = await Reservation.find({
        parkingLot: id,
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          { startTime: { $lte: dayEnd, $gte: dayStart } },
          { endTime: { $lte: dayEnd, $gte: dayStart } },
          { startTime: { $lte: dayStart }, endTime: { $gte: dayEnd } }
        ]
      });

      // Calculate real-time availability for any time period
      const getAvailabilityForPeriod = (start, end) => {
        let overlappingCount = reservations.filter(reservation => 
          dateUtils.isOverlapping(start, end, reservation.startTime, reservation.endTime)
        ).length;
        return Math.max(0, parkingLot.totalSpots - overlappingCount);
      };

      // Return availability data
      res.json({
        success: true,
        data: {
          parkingLotId: id,
          totalSpots: parkingLot.totalSpots,
          date: date,
          currentAvailability: await parkingLot.calculateAvailableSpots(),
          // Allow checking availability for any time period
          checkAvailability: (startTime, endTime) => getAvailabilityForPeriod(startTime, endTime)
        }
      });
    } catch (error) {
      console.error('getAvailableTimeSlots error:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting available time slots',
        error: error.message
      });
    }
  },

  async isTimeSlotAvailable(req, res) {
    try {
      const { parkingLotId, startTime, endTime } = req.params;
      
      if (!parkingLotId || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'All parameters are required'
        });
      }
      
      // Validate input times (ensure they are in the future and startTime < endTime)
      if (new Date(startTime) <= new Date() || new Date(endTime) <= new Date(startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time range'
        });
      }
      
      // Query for overlapping reservations
      const overlappingReservationsCount = await Reservation.countDocuments({
        parkingLot: parkingLotId,
        status: { $ne: 'cancelled' },
        $or: [
          // Case 1: Reservation starts during the requested period
          { startTime: { $gte: startTime, $lt: endTime } },
          // Case 2: Reservation ends during the requested period
          { endTime: { $gt: startTime, $lte: endTime } },
          // Case 3: Reservation completely covers the requested period
          { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
        ]
      });
      
      // Get the parking lot
      const parkingLot = await ParkingLot.findById(parkingLotId);
      
      // Check if spots are available
      const isAvailable = parkingLot.totalSpots > overlappingReservationsCount;
      
      return res.json({
        success: true,
        data: {
          parkingLotId,
          startTime,
          endTime,
          isAvailable
        }
      });
    } catch (error) {
      console.error('isTimeSlotAvailable error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking time slot availability',
        error: error.message
      });
    }
  }
};

module.exports = parkingLotsController; 