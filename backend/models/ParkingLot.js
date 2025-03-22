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
  }
}, { timestamps: true });

// Add geospatial index for location-based queries
parkingLotSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 