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
parkingLotSchema.methods.calculateAvailableSpots = async function(time = new Date()) {
  const Reservation = mongoose.model('Reservation');
  
  // Count active reservations for the given time
  const activeReservations = await Reservation.countDocuments({
    parkingLot: this._id,
    status: { $in: ['pending', 'confirmed'] },
    startTime: { $lte: time },
    endTime: { $gt: time }
  });
  
  // Update availableSpots property
  this.availableSpots = Math.max(0, this.totalSpots - activeReservations);
  return this.availableSpots;
};

// Method to update and save available spots
parkingLotSchema.methods.updateAvailableSpots = async function() {
  await this.calculateAvailableSpots();
  return this.save();
};

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 