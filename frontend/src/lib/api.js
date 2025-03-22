import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create an axios instance with a base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add a request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor with better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle token expiration
    if (error.response && error.response.status === 401) {
      // Clear token if it's invalid or expired
      if (localStorage.getItem('token')) {
        console.log('Token expired or invalid, logging out');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        
        // Optionally redirect to login
        window.location.href = '/login?expired=true';
      }
    }
    
    // Create a more user-friendly error object
    const customError = {
      message: error.response?.data?.message || 'Something went wrong with the request',
      status: error.response?.status || 500,
      data: error.response?.data || {},
      isNetworkError: error.message === 'Network Error',
      isTimeout: error.code === 'ECONNABORTED'
    };
    
    // Log the error for debugging
    console.error('API Error:', customError);
    
    return Promise.reject(customError);
  }
);

// Authentication API functions
export const loginUser = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Parking Lots API functions
export const getNearbyParkingLots = async (longitude, latitude, maxDistance = 5000) => {
  try {
    const response = await api.get('/parking-lots/nearby', {
      params: { longitude, latitude, maxDistance }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getParkingLotById = async (id) => {
  try {
    const response = await api.get(`/parking-lots/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Reservations API functions
export const createReservation = async (reservationData) => {
  try {
    const response = await api.post('/reservations/create', reservationData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getUserReservations = async () => {
  try {
    const response = await api.get('/reservations/user');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const cancelReservation = async (reservationId) => {
  try {
    const response = await api.delete(`/reservations/${reservationId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export default api;