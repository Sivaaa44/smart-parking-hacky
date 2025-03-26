const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parkingLot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingLot',
    required: true
  },
  parkingSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingSlot'
  },
  vehicleType: {
    type: String,
    enum: ['car', 'bike'],
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    // Not required for open-ended reservations
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  // Base amount when the reservation is created (for first hour)
  baseAmount: {
    type: Number,
    required: true
  },
  // Final amount after checkout
  finalAmount: {
    type: Number
  },
  // Time when user physically entered
  checkInTime: {
    type: Date
  },
  // Time when user physically exited
  checkOutTime: {
    type: Date
  }
}, { timestamps: true });

/**
 * Calculate current parking fee based on time elapsed
 */
reservationSchema.methods.calculateCurrentFee = async function() {
  if (!this.startTime) {
    return 0;
  }
  
  // If reservation is completed, return the final amount
  if (this.status === 'completed' && this.finalAmount) {
    return this.finalAmount;
  }
  
  // For active reservations, calculate based on current time
  const ParkingLot = mongoose.model('ParkingLot');
  const parkingLot = await ParkingLot.findById(this.parkingLot);
  
  if (!parkingLot) {
    throw new Error('Parking lot not found');
  }
  
  // Calculate fee based on current time for active reservations
  return parkingLot.calculateParkingFee(
    this.startTime, 
    this.endTime || new Date(), 
    this.vehicleType
  );
};

/**
 * Complete an active reservation
 */
reservationSchema.methods.complete = async function() {
  if (this.status !== 'active') {
    throw new Error('Only active reservations can be completed');
  }
  
  this.status = 'completed';
  this.endTime = new Date();
  
  // Calculate final fee
  const ParkingLot = mongoose.model('ParkingLot');
  const parkingLot = await ParkingLot.findById(this.parkingLot);
  
  if (!parkingLot) {
    throw new Error('Parking lot not found');
  }
  
  this.finalAmount = parkingLot.calculateParkingFee(
    this.startTime, 
    this.endTime, 
    this.vehicleType
  );
  
  return this.save();
};

/**
 * Cancel an active reservation
 */
reservationSchema.methods.cancel = async function() {
  if (this.status !== 'active') {
    throw new Error('Only active reservations can be cancelled');
  }
  
  this.status = 'cancelled';
  this.endTime = new Date();
  
  return this.save();
};

module.exports = mongoose.model('Reservation', reservationSchema); 