const ParkingLot = require('../models/ParkingLot');

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
        Math.max(lot.availableSpaces + change, 0), 
        lot.totalSpaces
      );
      
      lot.availableSpaces = newAvailable;
      await lot.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`lot-${lot._id}`).emit('availability-update', {
          lotId: lot._id,
          availableSpaces: lot.availableSpaces
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
            totalSpaces: { $sum: "$totalSpaces" },
            availableSpaces: { $sum: "$availableSpaces" },
            averageOccupancy: {
              $avg: {
                $subtract: [
                  100,
                  { $multiply: [{ $divide: ["$availableSpaces", "$totalSpaces"] }, 100] }
                ]
              }
            }
          }
        }
      ]);

      res.json(stats[0] || {
        totalLots: 0,
        totalSpaces: 0,
        availableSpaces: 0,
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
        availableSpaces: { $gt: 0 }
      }).sort({ availableSpaces: -1 });

      res.json(lots);
    } catch (error) {
      res.status(500).json({ 
        message: 'Error finding parking lots', 
        error: error.message 
      });
    }
  }
};

module.exports = parkingLotsController; 