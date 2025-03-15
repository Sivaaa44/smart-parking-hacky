const mongoose = require('mongoose');
const moment = require('moment');
const dateUtils = require('../utils/dateUtils');

const parkingSlotSchema = new mongoose.Schema({
  parkingLot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingLot',
    required: true
  },
  slotNumber: {
    type: String,
    required: true
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['standard', 'handicap', 'electric'],
    default: 'standard'
  },
  currentReservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    default: null
  }
});

// Method to check if slot is available for a time period
parkingSlotSchema.methods.isAvailableForPeriod = async function(startTime, endTime) {
  const Reservation = mongoose.model('Reservation');
  
  // Convert times to UTC for consistent comparison
  const start = moment(startTime).utc();
  const end = moment(endTime).utc();

  const existingReservations = await Reservation.find({
    parkingSlot: this._id,
    status: 'active',
    $or: [
      {
        startTime: { $lt: end.toDate() },
        endTime: { $gt: start.toDate() }
      }
    ]
  });

  return existingReservations.length === 0;
};

// Static method to find available slots for a time period
parkingSlotSchema.statics.findAvailableSlots = async function(parkingLotId, startTime, endTime) {
  const slots = await this.find({ parkingLot: parkingLotId });
  const availableSlots = [];

  for (const slot of slots) {
    if (await slot.isAvailableForPeriod(startTime, endTime)) {
      availableSlots.push(slot);
    }
  }

  return availableSlots;
};

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema); 