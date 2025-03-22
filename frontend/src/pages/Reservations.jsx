import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../lib/api';

const Reservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // Check for success message from navigation state
    if (location.state?.success) {
      setSuccessMessage(location.state.message);
      // Clear the state after displaying the message
      window.history.replaceState({}, document.title);
    }

    const fetchReservations = async () => {
      try {
        const response = await api.get('/reservations/user');
        const processedReservations = processReservations(response.data.data || []);
        setReservations(processedReservations);
      } catch (err) {
        console.error("Error fetching reservations:", err);
        setError('Failed to load reservations. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [location]);

  const handleCancelReservation = async (id) => {
    try {
      setLoading(true);
      await api.post(`/reservations/${id}/cancel`);
      
      // Update the local state
      setReservations(prevReservations => 
        prevReservations.map(res => 
          res._id === id ? {...res, status: 'cancelled', displayStatus: 'cancelled'} : res
        )
      );
      
      setSuccessMessage('Reservation cancelled successfully');
    } catch (err) {
      console.error("Error cancelling reservation:", err);
      setError('Failed to cancel reservation: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  // Calculate duration in hours and minutes
  const getDuration = (start, end) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime - startTime;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  // Add a function to detect and handle stale or expired reservations
  const processReservations = (reservations) => {
    const currentTime = new Date();
    
    return reservations.map(reservation => {
      const endTime = new Date(reservation.endTime);
      const startTime = new Date(reservation.startTime);
      
      // If reservation end time is in the past but status is still active,
      // mark it as "completed" for display purposes
      if (endTime < currentTime && 
          (reservation.status === 'pending' || reservation.status === 'confirmed')) {
        return { ...reservation, displayStatus: 'completed' };
      }
      
      // If reservation start time is in the past but end time is in the future,
      // and status is still active, mark it as "in progress" for display
      if (startTime < currentTime && endTime > currentTime && 
          (reservation.status === 'pending' || reservation.status === 'confirmed')) {
        return { ...reservation, displayStatus: 'in-progress' };
      }
      
      // Otherwise, use the actual status
      return { ...reservation, displayStatus: reservation.status };
    });
  };

  // Add a retry mechanism for fetching reservations
  const fetchReservationsWithRetry = async (retries = 3) => {
    let attempt = 0;
    
    while (attempt < retries) {
      try {
        setLoading(true);
        const response = await api.get('/reservations/user');
        const processedReservations = processReservations(response.data.data || []);
        setReservations(processedReservations);
        setError(null);
        return;
      } catch (err) {
        console.error(`Error fetching reservations (attempt ${attempt + 1}):`, err);
        attempt++;
        
        if (attempt === retries) {
          setError('Failed to load reservations after multiple attempts');
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">My Reservations</h1>
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg text-gray-600 mb-4">You don't have any reservations yet.</p>
          <Link to="/map" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Find Parking
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservations.map(reservation => (
            <div key={reservation._id} className="border rounded-lg p-5 shadow-sm bg-white">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg">{reservation.parkingLot?.name || 'Unknown Location'}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  reservation.displayStatus === 'completed' ? 'bg-green-100 text-green-800' :
                  reservation.displayStatus === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                  reservation.displayStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                  reservation.displayStatus === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {reservation.displayStatus.charAt(0).toUpperCase() + reservation.displayStatus.slice(1)}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-1">{reservation.parkingLot?.address}</p>
              
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Vehicle</span>
                  <span className="font-medium">{reservation.vehicleNumber} ({reservation.vehicleType})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Start Time</span>
                  <span>{formatDate(reservation.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">End Time</span>
                  <span>{formatDate(reservation.endTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Duration</span>
                  <span>{getDuration(reservation.startTime, reservation.endTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Total Cost</span>
                  <span className="font-bold">₹{reservation.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Payment Status</span>
                  <span className={`${
                    reservation.paymentStatus === 'completed' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {reservation.paymentStatus.charAt(0).toUpperCase() + reservation.paymentStatus.slice(1)}
                  </span>
                </div>
              </div>
              
              {(reservation.displayStatus === 'pending' || reservation.displayStatus === 'confirmed') && (
                <div className="mt-4 flex justify-end">
                  <button 
                    className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                    onClick={() => handleCancelReservation(reservation._id)}
                  >
                    Cancel Reservation
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reservations;