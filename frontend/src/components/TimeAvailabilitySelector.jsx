import { useState } from 'react';
import api from '../lib/api';

const TimeAvailabilitySelector = ({ parkingLots, onAvailabilityChange }) => {
  // Initialize with current IST date and time
  const now = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'}));
  
  // Format date to YYYY-MM-DD for input
  const formatDateForInput = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  // Format time to HH:MM for input
  const formatTimeForInput = (date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(now));
  const [selectedTime, setSelectedTime] = useState(formatTimeForInput(now));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Display IST time for clarity
  const currentISTTime = () => {
    const istNow = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'}));
    return `${String(istNow.getHours()).padStart(2, '0')}:${String(istNow.getMinutes()).padStart(2, '0')}`;
  };
  
  const checkAvailabilityForTime = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Create date in IST, then convert to ISO string
      // First construct the datetime string in IST
      const datetimeString = `${selectedDate}T${selectedTime}:00`;
      
      // Parse it assuming it's in IST
      const startDateTime = new Date(datetimeString);
      
      // Add IST offset to get correct UTC time
      const istOffsetMinutes = 330; // IST is UTC+5:30
      startDateTime.setMinutes(startDateTime.getMinutes() + startDateTime.getTimezoneOffset());
      
      // Validate start time is not in the past
      const now = new Date();
      if (startDateTime < now) {
        throw new Error('Please select a future time');
      }
      
      // End time is 1 hour after start time
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      
      // Convert to ISO strings for API
      const startISO = startDateTime.toISOString();
      const endISO = endDateTime.toISOString();
      
      // Check availability for all lots at this time
      const lotsWithAvailability = await Promise.all(
        parkingLots.map(async (lot) => {
          try {
            const response = await api.get(`/parking-lots/${lot._id}/check-availability`, {
              params: {
                startTime: startISO,
                endTime: endISO
              }
            });
            
            if (response.data && response.data.success) {
              return {
                ...lot,
                // Add time-specific availability
                timeSpecificAvailableSpots: response.data.data.availableSpots,
                totalReservationsAtTime: response.data.data.requestedTimeReservations
              };
            }
            return lot;
          } catch (error) {
            console.error(`Error checking availability for lot ${lot._id}:`, error);
            return lot;
          }
        })
      );
      
      // Call the callback with updated lots
      onAvailabilityChange(lotsWithAvailability, {
        startTime: startDateTime,
        endTime: endDateTime,
        formattedTime: `${selectedDate} ${selectedTime} IST`
      });
    } catch (error) {
      console.error('Error checking time availability:', error);
      setError(error.message || 'Failed to check availability');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-medium text-gray-900 mb-3">Check Availability By Time (IST)</h3>
      
      <div className="text-xs text-gray-600 mb-2">
        Current IST time: {currentISTTime()}
      </div>
      
      {error && (
        <div className="mb-3 text-sm text-red-600 p-2 bg-red-50 rounded">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 border rounded"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={formatDateForInput(now)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Time (IST)</label>
          <input
            type="time"
            className="w-full px-3 py-2 border rounded"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
          />
        </div>
      </div>
      
      <button
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        onClick={checkAvailabilityForTime}
        disabled={isLoading}
      >
        {isLoading ? 'Checking...' : 'Check Availability'}
      </button>
    </div>
  );
};

export default TimeAvailabilitySelector; 