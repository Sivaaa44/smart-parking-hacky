const ParkingLot = require('../models/ParkingLot');
const Reservation = require('../models/Reservation');
const ParkingSlot = require('../models/ParkingSlot');
const moment = require('moment');
const dateUtils = require('../utils/dateUtils');
const {isTimeSlotAvailable} = require('./reservations.controller');

const parkingLotsController = {
  // Get nearby parking lots
  async getNearby(req, res) {
    try {
      const { longitude, latitude, maxDistance = 5000 } = req.query;

      // Validate coordinates
      if (!longitude || !latitude) {
        return res.status(400).json({ 
          message: 'Both longitude and latitude are required' 
        });
      }

      const parsedLong = parseFloat(longitude);
      const parsedLat = parseFloat(latitude);

      // Validate coordinate values
      if (isNaN(parsedLong) || isNaN(parsedLat) ||
          parsedLong < -180 || parsedLong > 180 ||
          parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({ 
          message: 'Invalid coordinates provided' 
        });
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
        isOpen: true // Only return open parking lots
      }).select('-__v');

      res.json(nearbyLots);
    } catch (error) {
      console.error('getNearby error:', error);
      res.status(500).json({ 
        message: 'Error finding nearby lots', 
        error: error.message 
      });
    }
  },

  // Get specific parking lot
  async getOne(req, res) {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid parking lot ID' });
      }

      const lot = await ParkingLot.findById(req.params.id).select('-__v');
      if (!lot) {
        return res.status(404).json({ message: 'Parking lot not found' });
      }
      res.json(lot);
    } catch (error) {
      console.error('getOne error:', error);
      res.status(500).json({ 
        message: 'Error finding parking lot', 
        error: error.message 
      });
    }
  },

  // Simulate parking lot availability changes
  async simulate(req, res) {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid parking lot ID' });
      }

      const lot = await ParkingLot.findById(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Parking lot not found' });
      }

      if (!lot.isOpen) {
        return res.status(400).json({ message: 'Parking lot is closed' });
      }

      // Generate random change in available spaces
      const change = Math.floor(Math.random() * 3) - 1;
      const newAvailable = Math.min(
        Math.max(lot.availableSpots + change, 0),
        lot.totalSpots
      );
      
      lot.availableSpots = newAvailable;
      await lot.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`lot-${lot._id}`).emit('availability-update', {
          lotId: lot._id,
          availableSpots: lot.availableSpots
        });
      }

      res.json(lot);
    } catch (error) {
      console.error('simulate error:', error);
      res.status(500).json({ 
        message: 'Error simulating availability', 
        error: error.message 
      });
    }
  },

  // Get parking lot statistics
  async getStatistics(req, res) {
    try {
      const stats = await ParkingLot.aggregate([
        {
          $group: {
            _id: null,
            totalLots: { $sum: 1 },
            totalSpots: { $sum: "$totalSpots" },
            availableSpots: { $sum: "$availableSpots" },
            averageOccupancy: {
              $avg: {
                $subtract: [
                  100,
                  { $multiply: [{ $divide: ["$availableSpots", "$totalSpots"] }, 100] }
                ]
              }
            }
          }
        }
      ]);

      res.json(stats[0] || {
        totalLots: 0,
        totalSpots: 0,
        availableSpots: 0,
        averageOccupancy: 0
      });
    } catch (error) {
      res.status(500).json({ message: 'Error getting statistics', error: error.message });
    }
  },

  // Find parking lots by destination
  async findByDestination(req, res) {
    try {
      const { destination, radius = 1000 } = req.query; // radius in meters
      
      // Use a geocoding service here to convert destination to coordinates
      // For now, using example coordinates
      const coordinates = [-73.935242, 40.730610]; // This should come from geocoding

      const lots = await ParkingLot.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: coordinates
            },
            $maxDistance: parseInt(radius)
          }
        },
        isOpen: true,
        availableSpots: { $gt: 0 }
      }).sort({ availableSpots: -1 });

      res.json(lots);
    } catch (error) {
      res.status(500).json({ 
        message: 'Error finding parking lots', 
        error: error.message 
      });
    }
  },

  // Get available slots for a parking lot
  async getAvailableSlots(req, res) {
    try {
      const parkingLotId = req.params.id;
      const { startTime, endTime } = req.query;

      if (!startTime || !endTime) {
        return res.status(400).json({
          message: 'Both startTime and endTime are required'
        });
      }

      const start = moment(startTime);
      const end = moment(endTime);

      if (!start.isValid() || !end.isValid()) {
        return res.status(400).json({
          message: 'Invalid date format'
        });
      }

      const availableSlots = await ParkingSlot.findAvailableSlots(
        parkingLotId,
        start,
        end
      );

      res.json(availableSlots);
    } catch (error) {
      console.error('getAvailableSlots error:', error);
      res.status(500).json({
        message: 'Error getting available slots',
        error: error.message
      });
    }
  },

  // Get available time slots for a parking lot
  async getAvailableTimeSlots(req, res) {
    try {
      const parkingLotId = req.params.id;
      const requestedDate = req.query.date ? moment(req.query.date) : moment();
      
      // Get all slots for this parking lot
      const allSlots = await ParkingSlot.find({ parkingLot: parkingLotId });
      
      // Get time slots for the day
      const timeSlots = dateUtils.getTimeSlots(requestedDate);
      
      // Get all active reservations for this date
      const reservations = await Reservation.find({
        parkingLot: parkingLotId,
        status: 'active',
        startTime: {
          $gte: moment(requestedDate).startOf('day').toDate(),
          $lte: moment(requestedDate).endOf('day').toDate()
        }
      });

      // Calculate availability for each time slot
      for (const slot of timeSlots) {
        const slotStart = moment(slot.startTime);
        const slotEnd = moment(slot.endTime);
        
        let availableCount = allSlots.length;

        // Check each reservation that might overlap with this slot
        for (const reservation of reservations) {
          if (dateUtils.isOverlapping(
            slotStart, 
            slotEnd,
            reservation.startTime,
            reservation.endTime
          )) {
            availableCount--;
          }
        }

        slot.availableSlotCount = availableCount;
      }

      res.json(timeSlots);
    } catch (error) {
      console.error('getAvailableTimeSlots error:', error);
      res.status(500).json({
        message: 'Error getting available time slots',
        error: error.message
      });
    }
  },


  // Get lot availability
  async getLotAvailability(req, res) {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid parking lot ID' });
      }

      const lot = await ParkingLot.findById(req.params.id)
        .select('name availableSpots totalSpots types rates');
      
      if (!lot) {
        return res.status(404).json({
          success: false,
          message: 'Parking lot not found'
        });
      }

      res.json({
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
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching lot availability',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Check availability for a time slot
  async checkAvailabilityForTime(req, res) {
    try {
      const { id } = req.params;
      const { startTime, endTime } = req.query;
      
      if (!startTime || !endTime) {
        return res.status(400).json({
          message: 'Both startTime and endTime are required'
        });
      }
      
      // Find the parking lot
      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) {
        return res.status(404).json({ message: 'Parking lot not found' });
      }
      
      // Reuse the isTimeSlotAvailable method from reservationsController
      const isAvailable = await isTimeSlotAvailable(
        id, 
        new Date(startTime), 
        new Date(endTime)
      );
      
      // We need to get the count for the response, so get that from the same method
      // that's used in isTimeSlotAvailable
      const query = {
        parkingLot: id,
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          { startTime: { $lte: new Date(startTime) }, endTime: { $gt: new Date(startTime) } },
          { startTime: { $lt: new Date(endTime) }, endTime: { $gte: new Date(endTime) } },
          { startTime: { $gte: new Date(startTime) }, endTime: { $lte: new Date(endTime) } }
        ]
      };
      
      const overlappingReservationsCount = await Reservation.countDocuments(query);
      const spotsAvailableAtTime = parkingLot.totalSpots - overlappingReservationsCount;
      
      res.json({
        success: true,
        data: {
          parkingLotId: id,
          startTime,
          endTime,
          totalSpots: parkingLot.totalSpots,
          reservedSpots: overlappingReservationsCount,
          availableSpots: spotsAvailableAtTime,
          isAvailable: isAvailable
        }
      });
    } catch (error) {
      console.error('Check availability error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error checking availability',
        error: error.message 
      });
    }
  }
};

module.exports = parkingLotsController; 