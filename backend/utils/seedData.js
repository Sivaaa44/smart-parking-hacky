const mongoose = require('mongoose');
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const dotenv = require('dotenv');

dotenv.config();


const chennaiParkingLots = [
  {
    name: "T Nagar Parking Complex",
    location: {
      type: "Point",
      coordinates: [80.2337, 13.0418] // longitude, latitude
    },
    address: "Pondy Bazaar, T Nagar",
    landmark: "Near Panagal Park",
    totalSpots: 20,
    availableSpots: 20,
    isOpen: true,
    types: ["car", "bike"],
    rates: {
      car: {
        hourly: 50,
        daily: 400
      },
      bike: {
        hourly: 20,
        daily: 150
      }
    },
    operatingHours: {
      open: "06:00",
      close: "22:00"
    }
  },
  {
    name: "Anna Nagar Tower Plaza",
    location: {
      type: "Point",
      coordinates: [80.2089, 13.0850]
    },
    address: "2nd Avenue, Anna Nagar",
    landmark: "Near Tower Park",
    totalSpots: 20,
    availableSpots: 20,
    isOpen: true,
    types: ["car", "bike"],
    rates: {
      car: {
        hourly: 40,
        daily: 350
      },
      bike: {
        hourly: 15,
        daily: 120
      }
    },
    operatingHours: {
      open: "06:00",
      close: "22:00"
    }
  },
  {
    name: "Mylapore Temple Car Park",
    location: {
      type: "Point",
      coordinates: [80.2680, 13.0369]
    },
    address: "Mylapore, Chennai",
    landmark: "Near Kapaleeshwarar Temple",
    totalSpots: 20,
    availableSpots: 20,
    isOpen: true,
    types: ["car", "bike"],
    rates: {
      car: {
        hourly: 45,
        daily: 380
      },
      bike: {
        hourly: 18,
        daily: 140
      }
    },
    operatingHours: {
      open: "06:00",
      close: "21:00"
    }
  },
  {
    name: "Marina Beach Parking Zone",
    location: {
      type: "Point",
      coordinates: [80.2825, 13.0550]
    },
    address: "Marina Beach Road",
    landmark: "Opposite Marina Lighthouse",
    totalSpots: 20,
    availableSpots: 20,
    isOpen: true,
    types: ["car", "bike"],
    rates: {
      car: {
        hourly: 55,
        daily: 450
      },
      bike: {
        hourly: 25,
        daily: 200
      }
    },
    operatingHours: {
      open: "05:00",
      close: "23:00"
    }
  }
];

const createParkingSlots = async (parkingLot) => {
  const slots = [];
  const totalSlots = parkingLot.totalSpots || 20; // Fallback to 20 if not defined
  
  for (let i = 1; i <= totalSlots; i++) {
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
    for (const lotData of chennaiParkingLots) {
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

module.exports = chennaiParkingLots; 