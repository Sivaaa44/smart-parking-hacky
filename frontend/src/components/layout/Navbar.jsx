import { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  // Check if a path is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-white">ParkSmart</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'bg-blue-700 text-white' 
                  : 'text-blue-100 hover:bg-blue-500 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/map" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/map') 
                  ? 'bg-blue-700 text-white' 
                  : 'text-blue-100 hover:bg-blue-500 hover:text-white'
              }`}
            >
              Find Parking
            </Link>
            {isAuthenticated && (
              <Link 
                to="/reservations" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/reservations') 
                    ? 'bg-blue-700 text-white' 
                    : 'text-blue-100 hover:bg-blue-500 hover:text-white'
                }`}
              >
                My Reservations
              </Link>
            )}
          </div>

          {/* User menu / Auth buttons */}
          <div className="hidden md:ml-6 md:flex md:items-center">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link 
                  to="/profile" 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/profile') 
                      ? 'bg-blue-700 text-white' 
                      : 'text-blue-100 hover:bg-blue-500 hover:text-white'
                  }`}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="ml-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-700 hover:bg-blue-800 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="ml-2 px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-white bg-transparent hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-blue-200 hover:text-white hover:bg-blue-700 focus:outline-none"
            >
              <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
              <svg 
                className="h-6 w-6" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                aria-hidden="true"
              >
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-blue-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/') 
                  ? 'bg-blue-800 text-white' 
                  : 'text-blue-100 hover:bg-blue-600 hover:text-white'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/map"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/map') 
                  ? 'bg-blue-800 text-white' 
                  : 'text-blue-100 hover:bg-blue-600 hover:text-white'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Find Parking
            </Link>
            {isAuthenticated && (
              <Link
                to="/reservations"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/reservations') 
                    ? 'bg-blue-800 text-white' 
                    : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                My Reservations
              </Link>
            )}
            
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/profile') 
                      ? 'bg-blue-800 text-white' 
                      : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-red-600 hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-blue-600 hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-blue-600 hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;