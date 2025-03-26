const mongoose = require('mongoose');
const Reservation = require('./Reservation'); // Import at the top

const parkingLotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  address: {
    type: String,
    required: true
  },
  landmark: String,
  totalSpots: {
    type: Number,
    max: 20,
    required: true
  },
  availableSpots: {
    type: Number,
    required: true
  },
  types: [{
    type: String,
    enum: ['car', 'bike']
  }],
  // Simplified rate structure for open-ended parking
  rates: {
    car: {
      firstHour: {
        type: Number,
        default: 50
      },
      additionalHourly: {
        type: Number,
        default: 30
      },
      maxDaily: {
        type: Number,
        default: 300
      }
    },
    bike: {
      firstHour: {
        type: Number,
        default: 20
      },
      additionalHourly: {
        type: Number,
        default: 10
      },
      maxDaily: {
        type: Number,
        default: 100
      }
    }
  },
  operatingHours: {
    open: String,
    close: String
  },
  isOpen: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Add geospatial index for location-based queries
parkingLotSchema.index({ location: '2dsphere' });

/**
 * Calculate and update the current availability (right now)
 */
parkingLotSchema.methods.calculateAvailableSpots = async function() {
  const now = new Date();
  
  // Find active reservations right now
  const currentReservations = await Reservation.countDocuments({
    parkingLot: this._id,
    status: 'active',
    startTime: { $lte: now },
    $or: [
      { endTime: { $gt: now } },
      { endTime: null }
    ]
  });
  
  // Update current availability
  this.availableSpots = Math.max(0, this.totalSpots - currentReservations);
  await this.save();
  
  return this.availableSpots;
};

/**
 * Calculate parking fee based on duration
 * Implements tiered pricing: higher first hour, lower subsequent hours, with daily cap
 */
parkingLotSchema.methods.calculateParkingFee = function(startTime, endTime, vehicleType = 'car') {
  // If endTime not provided, use current time (for active sessions)
  const end = endTime || new Date();
  const start = new Date(startTime);
  
  // Calculate duration in hours
  const durationHours = (end - start) / (1000 * 60 * 60);
  
  // Get rate information for vehicle type (default to car if type not found)
  const rateInfo = this.rates[vehicleType] || this.rates.car;
  
  // Calculate fee with tiered pricing
  let totalFee = 0;
  
  if (durationHours <= 1) {
    // First hour (or fraction) charged at firstHour rate
    totalFee = rateInfo.firstHour;
  } else {
    // First hour + additional hours at lower rate
    totalFee = rateInfo.firstHour + (Math.ceil(durationHours - 1) * rateInfo.additionalHourly);
  }
  
  // Apply daily cap if exists
  if (rateInfo.maxDaily) {
    totalFee = Math.min(totalFee, rateInfo.maxDaily);
  }
  
  return Math.ceil(totalFee);
};

/**
 * Get availability for a specific future time
 * @param {Date} targetTime - The time to check availability for
 */
parkingLotSchema.methods.getAvailabilityForTime = async function(targetTime) {
  const target = new Date(targetTime);
  
  // Find reservations that will be active at the target time
  const activeReservationsCount = await Reservation.countDocuments({
    parkingLot: this._id,
    status: 'active',
    startTime: { $lte: target },
    $or: [
      { endTime: { $gt: target } },
      { endTime: null }
    ]
  });
  
  // Return calculated availability for that specific time
  return Math.max(0, this.totalSpots - activeReservationsCount);
};

/**
 * Get availability for each hour in a day
 * @param {Date} date - The date to check availability for
 */
parkingLotSchema.methods.getHourlyAvailability = async function(date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  
  // Get all reservations for this day
  const reservations = await Reservation.find({
    parkingLot: this._id,
    status: 'active',
    startTime: { $lt: dayEnd },
    $or: [
      { endTime: { $gt: dayStart } },
      { endTime: null }
    ]
  });
  
  // Calculate availability for each hour
  const hourlyAvailability = [];
  let currentHour = new Date(dayStart);
  
  while (currentHour < dayEnd) {
    const hourEnd = new Date(currentHour);
    hourEnd.setHours(hourEnd.getHours() + 1);
    
    // Count reservations active during this hour
    const activeCount = reservations.filter(reservation => {
      return reservation.startTime <= hourEnd && 
             (reservation.endTime === null || reservation.endTime > currentHour);
    }).length;
    
    hourlyAvailability.push({
      hour: currentHour.getHours(),
      displayTime: `${currentHour.getHours()}:00 - ${hourEnd.getHours()}:00`,
      startTime: new Date(currentHour),
      endTime: new Date(hourEnd),
      availableSpots: Math.max(0, this.totalSpots - activeCount)
    });
    
    // Move to next hour
    currentHour.setHours(currentHour.getHours() + 1);
  }
  
  return hourlyAvailability;
};

/**
 * Static method to update all parking lot availabilities
 * Useful for scheduled jobs
 */
parkingLotSchema.statics.updateAllAvailability = async function() {
  const lots = await this.find();
  
  for (const lot of lots) {
    await lot.calculateAvailableSpots();
  }
  
  return lots.length;
};

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 