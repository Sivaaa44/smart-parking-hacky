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

/**
 * Check if slot is available at current time
 */
parkingSlotSchema.methods.isAvailable = async function() {
  if (this.isOccupied) {
    return false;
  }
  
  if (!this.currentReservation) {
    return true;
  }
  
  // If there's a currentReservation, check if it's active
  const Reservation = mongoose.model('Reservation');
  const reservation = await Reservation.findById(this.currentReservation);
  
  return !reservation || reservation.status !== 'active';
};

/**
 * Occupy this slot with a reservation
 */
parkingSlotSchema.methods.occupy = async function(reservationId) {
  this.isOccupied = true;
  this.currentReservation = reservationId;
  return this.save();
};

/**
 * Release this slot
 */
parkingSlotSchema.methods.release = async function() {
  this.isOccupied = false;
  this.currentReservation = null;
  return this.save();
};

/**
 * Static method to find available slots in a lot
 */
parkingSlotSchema.statics.findAvailable = async function(parkingLotId) {
  const slots = await this.find({ parkingLot: parkingLotId });
  const availableSlots = [];
  
  for (const slot of slots) {
    if (await slot.isAvailable()) {
      availableSlots.push(slot);
    }
  }
  
  return availableSlots;
};

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema); 