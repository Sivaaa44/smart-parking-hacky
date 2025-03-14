const ParkingLot = require('../models/ParkingLot');

class ParkingSimulator {
  constructor(io) {
    this.io = io;
    this.simulationIntervals = new Map();
  }

  // Start simulation for a specific lot
  startSimulation(lotId, interval = 30000) { // Default 30 seconds
    if (this.simulationIntervals.has(lotId)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const lot = await ParkingLot.findById(lotId);
        if (!lot) {
          this.stopSimulation(lotId);
          return;
        }

        // Random change in available spaces (-1, 0, or 1)
        const change = Math.floor(Math.random() * 3) - 1;
        const newAvailable = Math.min(Math.max(lot.availableSpaces + change, 0), lot.totalSpaces);
        
        lot.availableSpaces = newAvailable;
        await lot.save();

        // Emit update
        this.io.to(`lot-${lotId}`).emit('availability-update', {
          lotId: lot._id,
          availableSpaces: lot.availableSpaces
        });

      } catch (error) {
        console.error(`Simulation error for lot ${lotId}:`, error);
      }
    }, interval);

    this.simulationIntervals.set(lotId, intervalId);
  }

  // Stop simulation for a specific lot
  stopSimulation(lotId) {
    const intervalId = this.simulationIntervals.get(lotId);
    if (intervalId) {
      clearInterval(intervalId);
      this.simulationIntervals.delete(lotId);
    }
  }

  // Stop all simulations
  stopAllSimulations() {
    for (const [lotId, intervalId] of this.simulationIntervals) {
      clearInterval(intervalId);
    }
    this.simulationIntervals.clear();
  }

  async simulateTimeBasedChanges(lotId) {
    const lot = await ParkingLot.findById(lotId);
    if (!lot) return;

    const hour = new Date().getHours();
    let probability;

    // Rush hour logic
    if (hour >= 7 && hour <= 9) {
      probability = 0.7; // 70% chance of occupancy increase
    } else if (hour >= 16 && hour <= 18) {
      probability = 0.6; // 60% chance of occupancy decrease
    } else {
      probability = 0.5; // Normal hours
    }

    const change = Math.random() < probability ? -1 : 1;
    const newAvailable = Math.min(
      Math.max(lot.availableSpaces + change, 0),
      lot.totalSpaces
    );

    lot.availableSpaces = newAvailable;
    await lot.save();

    return lot;
  }
}

module.exports = ParkingSimulator; 