const cron = require('node-cron');
const ParkingLot = require('../models/ParkingLot');

/**
 * Setup job to update parking lot availabilities
 * Runs every 5 minutes to ensure accurate data
 */
const setupUpdateJob = (io) => {
  // Schedule job to run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running parking lot availability update job`);
      
      // Update all parking lots
      const parkingLots = await ParkingLot.find();
      let updatedCount = 0;
      
      for (const lot of parkingLots) {
        const oldAvailability = lot.availableSpots;
        await lot.calculateAvailableSpots();
        
        // If availability changed, emit socket update
        if (oldAvailability !== lot.availableSpots && io) {
          io.emit('map-availability-update', {
            lotId: lot._id,
            availableSpots: lot.availableSpots,
            wasScheduledUpdate: true
          });
          updatedCount++;
        }
      }
      
      console.log(`[${new Date().toISOString()}] Updated ${updatedCount} parking lots with changed availability`);
    } catch (error) {
      console.error('Error in parking lot update job:', error);
    }
  });
  
  console.log('Parking lot availability update job scheduled');
};

module.exports = { setupUpdateJob }; 