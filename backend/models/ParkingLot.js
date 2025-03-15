const mongoose = require('mongoose');

const parkingLotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
  totalSpaces: {
    type: Number,
    required: true,
    min: 1
  },
  availableSpaces: {
    type: Number,
    required: true,
    min: 0
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  slots: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingSlot'
  }]
}, {
  timestamps: true
});

// Create geospatial index
parkingLotSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 