const mongoose = require('mongoose');
const ParkingLot = require('../models/ParkingLot');
const dotenv = require('dotenv');

dotenv.config();

const sampleParkingLots = [
  {
    name: "Downtown Parking A",
    location: {
      type: "Point",
      coordinates: [-73.935242, 40.730610] // Example coordinates
    },
    address: "123 Main St, Downtown",
    totalSpaces: 100,
    availableSpaces: 50,
    hourlyRate: 10,
    isOpen: true
  },
  // Add more sample parking lots here
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await ParkingLot.deleteMany({});
    await ParkingLot.insertMany(sampleParkingLots);
    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase(); 