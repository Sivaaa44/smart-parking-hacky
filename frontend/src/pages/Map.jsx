import { useState, useEffect, useRef, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

// Create better marker icons for different availability states
const createParkingIcon = (available, total) => {
  const percentage = available / total;
  let color;
  
  if (available === 0) {
    color = '#ef4444'; // Red for full
  } else if (percentage < 0.3) {
    color = '#f59e0b'; // Amber for limited
  } else {
    color = '#10b981'; // Green for available
  }
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 36px; 
        height: 36px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        background-color: ${color}; 
        color: white; 
        font-weight: bold;
        border-radius: 50%; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 2px solid white;
      ">${available}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

// Component to update map center when state changes
function MapCenterUpdater({ center }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
}

// Main Map component
const MapPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parkingLots, setParkingLots] = useState([]);
  const [filteredLots, setFilteredLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const navigate = useNavigate();
  const [center, setCenter] = useState([13.0827, 80.2707]); // Chennai
  const [mapInitialized, setMapInitialized] = useState(false);
  const [filters, setFilters] = useState({
    minAvailability: 0,
    maxPrice: 1000,
    onlyAvailable: false
  });
  const mapRef = useRef(null);
  const { token, isAuthenticated } = useContext(AuthContext);

  // Load parking lots on initial render - using default Chennai coordinates
  useEffect(() => {
    // Using default Chennai coordinates
    fetchDefaultParkingLots();
    setMapInitialized(true);
  }, [token]);

  // Filter parking lots whenever filters or parkingLots change
  useEffect(() => {
    applyFilters();
  }, [parkingLots, filters]);

  // Fetch default parking lots using the nearby endpoint with Chennai coordinates
  const fetchDefaultParkingLots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the /nearby endpoint with default Chennai coordinates
      const response = await axios.get(`http://localhost:5000/api/parking-lots/nearby`, {
        params: {
          longitude: 80.2707, // Chennai longitude
          latitude: 13.0827,  // Chennai latitude
          maxDistance: 10000  // 10km radius for wider coverage
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : '' 
        }
      });
      
      if (response.data && response.data.length > 0) {
        setParkingLots(response.data);
      } else {
        // Fallback to mock data if no results
        setParkingLots(getMockParkingLots());
        setError('No parking lots found. Showing sample data.');
      }
    } catch (err) {
      console.error("Error fetching parking lots:", err);
      // Use mock data if the API fails
      setParkingLots(getMockParkingLots());
      setError('Using sample data - Backend connection issue');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data in case the API fails
  const getMockParkingLots = () => {
    return [
      {
        _id: "1",
        name: "Central Station Parking",
        address: "Chennai Central, EVR Periyar Salai",
        totalSpots: 100,
        availableSpots: 45,
        rates: { standard: { hourly: 40 } },
        location: { coordinates: [80.2707, 13.0827] }
      },
      {
        _id: "2",
        name: "T. Nagar Parking Complex",
        address: "Panagal Park, T. Nagar",
        totalSpots: 80,
        availableSpots: 10,
        rates: { standard: { hourly: 50 } },
        location: { coordinates: [80.2400, 13.0400] }
      },
      {
        _id: "3",
        name: "Marina Beach Parking",
        address: "Marina Beach Road",
        totalSpots: 120,
        availableSpots: 0,
        rates: { standard: { hourly: 30 } },
        location: { coordinates: [80.2838, 13.0600] }
      },
      {
        _id: "4",
        name: "Phoenix Market City Parking",
        address: "Velachery Main Road",
        totalSpots: 200,
        availableSpots: 75,
        rates: { standard: { hourly: 60 } },
        location: { coordinates: [80.2230, 13.0171] }
      },
      {
        _id: "5",
        name: "Express Avenue Parking",
        address: "Whites Road, Royapettah",
        totalSpots: 150,
        availableSpots: 32,
        rates: { standard: { hourly: 70 } },
        location: { coordinates: [80.2610, 13.0559] }
      }
    ];
  };

  // Apply filters to parking lots
  const applyFilters = () => {
    const filtered = parkingLots.filter(lot => {
      // Check if lot passes all filters
      if (filters.onlyAvailable && lot.availableSpots === 0) return false;
      if (lot.availableSpots < filters.minAvailability) return false;
      
      // Check price filter (hourly rate)
      const hourlyRate = lot.rates?.standard?.hourly || 0;
      if (hourlyRate > filters.maxPrice) return false;
      
      return true;
    });
    
    setFilteredLots(filtered);
  };

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle selecting a parking lot
  const handleSelectLot = (lot) => {
    setSelectedLot(lot);
    
    // Center map on selected lot
    if (lot.location && lot.location.coordinates) {
      setCenter([lot.location.coordinates[1], lot.location.coordinates[0]]);
    }
  };

  // Handle reservation button click
  const handleReservation = (lotId) => {
    if (!isAuthenticated) {
      // Save current URL to redirect back after login
      navigate('/login', { state: { from: `/map` } });
      return;
    }
    
    // Make sure we have valid lot ID before navigating
    if (!lotId) {
      console.error("Invalid parking lot ID");
      return;
    }
    
    // Navigate to reservation form with lot ID
    navigate(`/reserve/${lotId}`);
  };

  // Find parking near me
  const handleFindNearMe = () => {
    if (navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = [position.coords.latitude, position.coords.longitude];
          setCenter(userPos);
          
          // Fetch nearby parking lots based on user's location
          fetchNearbyParkingLots(position.coords.longitude, position.coords.latitude);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError("Could not access your location.");
          setIsLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  // Fetch nearby parking lots
  const fetchNearbyParkingLots = async (longitude, latitude) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`http://localhost:5000/api/parking-lots/nearby`, {
        params: {
          longitude,
          latitude,
          maxDistance: 5000 // 5km radius
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : '' 
        }
      });
      
      if (response.data && response.data.length > 0) {
        setParkingLots(response.data);
      } else {
        // If no nearby lots found, show a helpful message
        setError('No parking lots found near your location. Try viewing all parking lots.');
        // Keep existing parking lots visible if any
        if (parkingLots.length === 0) {
          setParkingLots(getMockParkingLots());
        }
      }
    } catch (err) {
      console.error("Error fetching nearby parking lots:", err);
      // Don't replace existing data with mock data if we already have real data
      if (parkingLots.length === 0) {
        setParkingLots(getMockParkingLots());
        setError('Using demo data - could not fetch nearby parking lots.');
      } else {
        setError('Could not fetch nearby parking lots, showing previous results.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset view to show all lots (uses Chennai coordinates)
  const handleShowAllLots = () => {
    fetchDefaultParkingLots();
    setCenter([13.0827, 80.2707]); // Reset to Chennai center
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Search & Filters */}
      <div className="w-1/3 bg-white overflow-auto border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <h1 className="text-xl font-bold text-gray-800">Find Parking</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredLots.length} available parking locations
          </p>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b">
          <button
            onClick={handleFindNearMe}
            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Find Parking Near Me
          </button>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Available Spots
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={filters.minAvailability}
                onChange={(e) => handleFilterChange('minAvailability', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>0</span>
                <span>{filters.minAvailability} spots</span>
                <span>50+</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Hourly Rate
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>₹0</span>
                <span>₹{filters.maxPrice}</span>
                <span>₹200+</span>
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                id="available-only"
                type="checkbox"
                checked={filters.onlyAvailable}
                onChange={(e) => handleFilterChange('onlyAvailable', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="available-only" className="ml-2 block text-sm text-gray-700">
                Show only available parking
              </label>
            </div>
          </div>
        </div>

        {/* Parking Lots List */}
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 m-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No parking lots match your filters.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLots.map(lot => (
                <div 
                  key={lot._id} 
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedLot?._id === lot._id ? 'bg-blue-50 border-l-4 border-blue-500 pl-3' : ''
                  }`}
                  onClick={() => handleSelectLot(lot)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{lot.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{lot.address || 'Address not available'}</p>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                      lot.availableSpots === 0 ? 'bg-red-100 text-red-800' :
                      lot.availableSpots < lot.totalSpots * 0.3 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {lot.availableSpots === 0 ? 'Full' : 
                       lot.availableSpots < lot.totalSpots * 0.3 ? 'Limited' : 'Available'}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{lot.availableSpots}</span>
                      <span className="text-gray-500"> of </span>
                      <span>{lot.totalSpots}</span>
                      <span className="text-gray-500"> spots</span>
                    </div>
                    <div className="text-gray-600">
                      ₹{lot.rates?.standard?.hourly || 'N/A'}/hr
                    </div>
                  </div>
                  
                  <button 
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReservation(lot._id);
                    }}
                    disabled={lot.availableSpots === 0}
                  >
                    {lot.availableSpots === 0 ? 'No Spots Available' : 'Reserve a Spot'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map Container - Two-thirds of the page */}
      <div className="w-2/3 h-full relative">
        {mapInitialized && (
          <MapContainer 
            center={center} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapCenterUpdater center={center} />
            
            {/* Parking lot markers */}
            {filteredLots.map(lot => {
              if (lot.location && lot.location.coordinates) {
                const position = [lot.location.coordinates[1], lot.location.coordinates[0]];
                return (
                  <Marker 
                    key={lot._id} 
                    position={position}
                    icon={createParkingIcon(lot.availableSpots, lot.totalSpots)}
                    eventHandlers={{
                      click: () => {
                        setSelectedLot(lot);
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-center p-1">
                        <h3 className="font-bold text-gray-900">{lot.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{lot.address || 'Address not available'}</p>
                        <div className="flex justify-between items-center mt-2 text-sm">
                          <span>
                            <span className="font-medium">{lot.availableSpots}</span>/{lot.totalSpots} spots
                          </span>
                          <span className="font-medium">₹{lot.rates?.standard?.hourly || 'N/A'}/hr</span>
                        </div>
                        <button 
                          className={`mt-2 w-full py-1 px-3 rounded text-xs font-medium text-white ${
                            lot.availableSpots === 0 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          onClick={() => handleReservation(lot._id)}
                          disabled={lot.availableSpots === 0}
                        >
                          {lot.availableSpots === 0 ? 'Full' : 'Reserve Now'}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              }
              return null;
            })}
          </MapContainer>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;