const cron = require('node-cron');
const ParkingLot = require('../models/ParkingLot');
const mongoose = require('mongoose');

// Setup update job to run every 5 minutes
const setupUpdateJob = (io) => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('Running parking lot availability update job...');
      
      // Ensure mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
      }
      
      // Update all parking lots
      await ParkingLot.updateAllAvailability();
      
      // Get all parking lots to broadcast updates
      const lots = await ParkingLot.find({}, '_id availableSpots');
      
      // Broadcast updates to all clients
      if (io) {
        lots.forEach(lot => {
          io.emit('map-availability-update', {
            lotId: lot._id,
            availableSpots: lot.availableSpots,
            wasAutoUpdate: true
          });
        });
        
        console.log(`Broadcast availability updates for ${lots.length} lots`);
      }
    } catch (error) {
      console.error('Error in parking lot update job:', error);
    }
  });
  
  console.log('Parking lot availability update job scheduled');
};

module.exports = { setupUpdateJob }; 