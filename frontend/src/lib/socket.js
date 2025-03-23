import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Log connection events
socket.on('connect', () => {
  console.log('Socket connected with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message);
});

// Helper functions for parking lot subscriptions
export const subscribeToParkingLot = (lotId) => {
  if (!socket.connected) {
    console.warn('Socket not connected, will subscribe when connected');
    socket.on('connect', () => {
      socket.emit('subscribe-to-lot', lotId);
      console.log(`Subscribed to lot ${lotId} after reconnect`);
    });
    return;
  }
  
  socket.emit('subscribe-to-lot', lotId);
  console.log(`Subscribed to lot ${lotId}`);
};

export const unsubscribeFromParkingLot = (lotId) => {
  if (socket.connected) {
    socket.emit('unsubscribe-from-lot', lotId);
    console.log(`Unsubscribed from lot ${lotId}`);
  }
};

export default socket; 