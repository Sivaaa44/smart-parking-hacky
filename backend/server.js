const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require('http');
const socketIo = require('socket.io');
const ParkingSimulator = require('./utils/simulator');
const reservationController = require('./controllers/reservations.controller');
const { setupUpdateJob } = require('./jobs/updateAvailability');

// Load environment variables before any other configuration
dotenv.config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('FATAL ERROR: MONGODB_URI is not defined.');
  process.exit(1);
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to Database with error handling
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Export io instance to be used in other files (move this before routes)
app.set('io', io);

// Initialize simulator before routes
const simulator = new ParkingSimulator(io);
app.set('simulator', simulator);

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/parking-lots', require('./routes/parkingLots.routes'));
app.use('/api/reservations', require('./routes/reservations.routes'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Park Smart API is running' });
});

// Socket.io setup with error handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('subscribe-to-lot', (lotId) => {
    if (!lotId) return;
    socket.join(`lot-${lotId}`);
    simulator.emitLotAvailability(lotId);
    console.log(`Client ${socket.id} subscribed to lot ${lotId}`);
  });
  
  socket.on('unsubscribe-from-lot', (lotId) => {
    if (!lotId) return;
    socket.leave(`lot-${lotId}`);
    console.log(`Client ${socket.id} unsubscribed from lot ${lotId}`);
  });
  
  socket.on('create-reservation', async (data) => {
    try {
      const result = await reservationController.createReservationSocket(data);
      socket.emit('reservation-status', { success: true, data: result.reservation });
      
      io.to(`lot-${data.lotId}`).emit('availability-update', {
        lotId: data.lotId,
        availableSpots: result.updatedAvailability
      });
    } catch (error) {
      socket.emit('reservation-status', { 
        success: false, 
        error: error.message 
      });
    }
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// After setting up socket.io
setupUpdateJob(io);

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something broke!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  simulator.stopAllSimulations();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // For testing purposes