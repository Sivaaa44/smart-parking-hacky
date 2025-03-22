import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../lib/api';

const ReservationForm = () => {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);
  
  const [parkingLot, setParkingLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    vehicleType: 'car',
    vehicleNumber: '',
    startTime: '',
    endTime: '',
  });
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeSlotAvailable, setTimeSlotAvailable] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/reserve/${lotId}` } });
    }
  }, [isAuthenticated, navigate, lotId]);

  // Fetch parking lot details
  useEffect(() => {
    const fetchParkingLot = async () => {
      try {
        const response = await api.get(`/parking-lots/${lotId}`);
        setParkingLot(response.data);
        
        // Set default times (current time + 1 hour for start, start + 1 hour for end)
        const now = new Date();
        const startTime = new Date(now.setHours(now.getHours() + 1));
        startTime.setMinutes(0, 0, 0); // Round to nearest hour
        
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);
        
        setFormData({
          ...formData,
          startTime: formatDateTime(startTime),
          endTime: formatDateTime(endTime),
        });
        
        // Calculate initial amount
        calculateAmount(startTime, endTime, formData.vehicleType);
      } catch (err) {
        console.error("Error fetching parking lot:", err);
        setError("Failed to load parking lot details");
      } finally {
        setLoading(false);
      }
    };

    if (lotId) {
      fetchParkingLot();
    }
  }, [lotId]);

  // Format date to YYYY-MM-DDThh:mm
  const formatDateTime = (date) => {
    return date.toISOString().slice(0, 16);
  };

  // Calculate reservation amount based on times and vehicle type
  const calculateAmount = (start, end, vehicleType) => {
    if (!parkingLot || !start || !end) return;
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const durationHours = (endTime - startTime) / (1000 * 60 * 60); // in hours
    
    // Get the rate for the vehicle type or fallback to standard rate
    const rate = parkingLot.rates?.[vehicleType]?.hourly || 
                 parkingLot.rates?.standard?.hourly || 50;
    
    const amount = Math.ceil(durationHours * rate);
    setCalculatedAmount(amount);
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Recalculate amount when relevant fields change
    if (name === 'vehicleType' || name === 'startTime' || name === 'endTime') {
      calculateAmount(
        name === 'startTime' ? value : formData.startTime,
        name === 'endTime' ? value : formData.endTime,
        name === 'vehicleType' ? value : formData.vehicleType
      );
    }
  };

  // Update the setupInitialTimes function to ensure valid default times
  const setupInitialTimes = () => {
    const now = new Date();
    // Round up to the next hour
    const startTime = new Date(now);
    startTime.setHours(now.getHours() + 1);
    startTime.setMinutes(0, 0, 0);
    
    // End time is 1 hour after start time
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    return {
      startTime: formatDateTime(startTime),
      endTime: formatDateTime(endTime),
    };
  };

  // Add better validation before form submission
  const validateForm = () => {
    // Validate vehicle number (at least 3 characters)
    if (formData.vehicleNumber.trim().length < 3) {
      setError("Please enter a valid vehicle number");
      return false;
    }
    
    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);
    const now = new Date();
    
    // Ensure start time is not in the past
    if (startTime < now) {
      setError("Start time cannot be in the past");
      return false;
    }
    
    // Ensure end time is after start time
    if (endTime <= startTime) {
      setError("End time must be after start time");
      return false;
    }
    
    // Ensure booking is not too long (e.g., max 24 hours)
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);
    if (durationHours > 24) {
      setError("Booking duration cannot exceed 24 hours");
      return false;
    }
    
    return true;
  };

  // Add this function to check availability when time inputs change
  const checkTimeSlotAvailability = async () => {
    if (!formData.startTime || !formData.endTime || !parkingLot) return;
    
    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);
    
    // Validate time inputs
    if (endTime <= startTime) {
      return;
    }
    
    setCheckingAvailability(true);
    
    try {
      const response = await api.get(`/parking-lots/${lotId}/check-availability`, {
        params: {
          startTime: formData.startTime,
          endTime: formData.endTime
        }
      });
      
      setTimeSlotAvailable(response.data.data.isAvailable);
      
      // Update calculated amount based on duration and rate
      calculateAmount(startTime, endTime, formData.vehicleType);
    } catch (err) {
      console.error("Error checking time slot availability:", err);
      setTimeSlotAvailable(false); // Assume unavailable on error
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Add a useEffect to check availability when times change
  useEffect(() => {
    const timer = setTimeout(() => {
      checkTimeSlotAvailability();
    }, 500); // Debounce to prevent too many API calls
    
    return () => clearTimeout(timer);
  }, [formData.startTime, formData.endTime]);

  // Modify the handleSubmit function to re-check availability before submitting
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Final availability check before submitting
    setSubmitting(true);
    setError(null);
    
    try {
      // Check if the time slot is still available
      const availabilityResponse = await api.get(`/parking-lots/${lotId}/check-availability`, {
        params: {
          startTime: formData.startTime,
          endTime: formData.endTime
        }
      });
      
      if (!availabilityResponse.data.data.isAvailable) {
        setError("This time slot is no longer available. Please select a different time.");
        setTimeSlotAvailable(false);
        setSubmitting(false);
        return;
      }
      
      // Continue with reservation creation
      const response = await api.post('/reservations/create', {
        parkingLotId: lotId,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
        startTime: formData.startTime,
        endTime: formData.endTime
      });
      
      // Redirect to reservations page on success
      navigate('/reservations', { 
        state: { success: true, message: 'Reservation created successfully!' } 
      });
    } catch (err) {
      console.error("Error creating reservation:", err);
      setError(err.message || "Failed to create reservation. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!parkingLot) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-400 text-red-700 p-4 rounded mb-4">
          Parking lot not found or has been removed.
        </div>
        <button 
          onClick={() => navigate('/map')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Back to Map
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-xl font-bold">Reserve Parking</h1>
          <p className="text-sm opacity-90">
            {parkingLot.name} - {parkingLot.address}
          </p>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 flex justify-between items-center">
            <div>
              <span className="block text-sm text-gray-500">Available Spots</span>
              <span className="text-2xl font-bold text-gray-900">
                {parkingLot.availableSpots} <span className="text-sm font-normal text-gray-500">of {parkingLot.totalSpots}</span>
              </span>
            </div>
            <div>
              <span className="block text-sm text-gray-500">Rate</span>
              <span className="text-xl font-medium text-gray-900">
                ₹{parkingLot.rates?.standard?.hourly || 'N/A'}/hour
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="vehicleType">
                Vehicle Type
              </label>
              <select
                id="vehicleType"
                name="vehicleType"
                value={formData.vehicleType}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="car">Car</option>
                <option value="bike">Bike</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="vehicleNumber">
                Vehicle Number
              </label>
              <input
                type="text"
                id="vehicleNumber"
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={handleChange}
                placeholder="E.g., TN01AB1234"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="startTime">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="endTime">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Time slot availability indicator */}
            {formData.startTime && formData.endTime && (
              <div className={`mb-4 p-3 rounded-md ${
                checkingAvailability 
                  ? 'bg-gray-100 text-gray-700' 
                  : timeSlotAvailable 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
              }`}>
                {checkingAvailability ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-700 mr-2"></div>
                    Checking availability...
                  </div>
                ) : timeSlotAvailable ? (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    This time slot is available!
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    This time slot is not available. Please select a different time.
                  </div>
                )}
              </div>
            )}

            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Estimated Cost:</span>
                <span className="text-xl font-bold text-gray-900">₹{calculatedAmount}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Based on the selected duration and vehicle type.
              </p>
            </div>

            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || parkingLot.availableSpots === 0}
                className={`px-6 py-2 rounded font-medium ${
                  parkingLot.availableSpots === 0
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : submitting
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {submitting ? 'Processing...' : parkingLot.availableSpots === 0 ? 'No Spots Available' : 'Confirm Reservation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReservationForm;