const mongoose = require('mongoose');

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
  rates: {
    car: {
      hourly: Number,
      daily: Number
    },
    bike: {
      hourly: Number,
      daily: Number
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

// Method to calculate real-time available spots
parkingLotSchema.methods.calculateAvailableSpots = async function() {
  const now = new Date();
  
  // Find active reservations that overlap with current time
  const activeReservations = await Reservation.countDocuments({
    parkingLot: this._id,
    status: { $in: ['pending', 'confirmed'] },
    startTime: { $lte: now },
    endTime: { $gt: now }
  });
  
  // Calculate available spots for current time
  const availableSpots = Math.max(0, this.totalSpots - activeReservations);
  
  // Update the parking lot
  this.availableSpots = availableSpots;
  await this.save();
  
  return availableSpots;
};

// Method to update and save available spots
parkingLotSchema.methods.updateAvailableSpots = async function() {
  await this.calculateAvailableSpots();
  return this.save();
};

// Method to get availability for a specific time period
parkingLotSchema.methods.getAvailabilityForTime = async function(startTime, endTime) {
  // Parse the times
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  // Find reservations that overlap with the specified time period
  const overlappingReservations = await Reservation.countDocuments({
    parkingLot: this._id,
    status: { $in: ['pending', 'confirmed'] },
    startTime: { $lt: end },
    endTime: { $gt: start }
  });
  
  // Calculate available spots for specified time
  return Math.max(0, this.totalSpots - overlappingReservations);
};

// Add a scheduled task to update parking lot availability
parkingLotSchema.statics.updateAllAvailability = async function() {
  const now = new Date();
  console.log(`Running scheduled update at ${now.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`);
  
  // Get all parking lots
  const parkingLots = await this.find();
  
  // Update each parking lot's availability
  for (const lot of parkingLots) {
    await lot.calculateAvailableSpots();
  }
  
  console.log(`Updated availability for ${parkingLots.length} parking lots`);
};

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 