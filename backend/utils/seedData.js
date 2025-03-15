const mongoose = require('mongoose');
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const dotenv = require('dotenv');

dotenv.config();

const sampleParkingLots = [
  {
    name: "Downtown Parking A",
    location: {
      type: "Point",
      coordinates: [-73.935242, 40.730610]
    },
    address: "123 Main St, Downtown",
    totalSpaces: 100,
    availableSpaces: 100,
    hourlyRate: 10,
    isOpen: true
  },
  {
    name: "Midtown Parking B",
    location: {
      type: "Point",
      coordinates: [-73.935242, 40.730610]
    },
    address: "456 Center St, Midtown",
    totalSpaces: 150,
    availableSpaces: 150,
    hourlyRate: 15,
    isOpen: true
  }
];

const createParkingSlots = async (parkingLot) => {
  const slots = [];
  for (let i = 1; i <= parkingLot.totalSpaces; i++) {
    const slot = new ParkingSlot({
      parkingLot: parkingLot._id,
      slotNumber: `A${i.toString().padStart(3, '0')}`,
      isOccupied: false,
      type: i % 10 === 0 ? 'handicap' : i % 20 === 0 ? 'electric' : 'standard'
    });
    await slot.save();
    slots.push(slot._id);
  }
  return slots;
};

const seedDatabase = async () => {
  try {
    console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Not found');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    // Clear existing data
    console.log('Clearing existing data...');
    await ParkingLot.deleteMany({});
    await ParkingSlot.deleteMany({});
    console.log('Cleared existing data');

    // Create parking lots and their slots
    console.log('Creating parking lots and slots...');
    for (const lotData of sampleParkingLots) {
      // Create the parking lot
      const lot = new ParkingLot(lotData);
      await lot.save();
      
      // Create slots for this lot
      console.log(`Creating slots for ${lot.name}...`);
      const slotIds = await createParkingSlots(lot);
      
      // Update lot with slot references
      lot.slots = slotIds;
      await lot.save();
      
      console.log(`Created parking lot ${lot.name} with ${slotIds.length} slots`);
    }

    // Verify the results
    const lotCount = await ParkingLot.countDocuments();
    const slotCount = await ParkingSlot.countDocuments();
    console.log(`Created ${lotCount} parking lots with ${slotCount} total slots`);

    console.log('Database seeded successfully');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Add error handler for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

seedDatabase(); 