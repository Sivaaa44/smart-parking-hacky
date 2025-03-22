import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if token is valid and user is authenticated on initial load
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          setToken(storedToken);
          // Set up axios default headers for all requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Extract user info from token
          const userInfo = parseJwt(storedToken);
          
          // Check token expiration
          if (userInfo && userInfo.exp && userInfo.exp * 1000 < Date.now()) {
            // Token expired, log out
            console.log('Token expired, logging out');
            logout();
          } else {
            setUser(userInfo);
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('Error authenticating user:', error);
          logout(); // Clear invalid token
        }
      }
      setLoading(false);
    };

    checkAuth();
    
    // Cleanup
    return () => {
      setLoading(false);
    };
  }, []);

  // Function to extract user data from JWT token
  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  };

  // Login function
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      // Handle the fact that backend only returns token
      const newToken = response.data.token;
      
      // Save token to localStorage
      localStorage.setItem('token', newToken);
      
      // Set token in context and axios headers
      setToken(newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      // Extract user info from token since backend doesn't return it separately
      const userData = parseJwt(newToken);
      
      // Update state
      setUser(userData);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setError(
        error.response?.data?.message || 
        'Login failed. Please check your credentials and try again.'
      );
      return false;
    }
  };

  // Register function
  const register = async (email, password) => {
    setError(null);
    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        email,
        password
      });

      // Handle the fact that backend only returns token
      const newToken = response.data.token;
      if (newToken) {
        // Save token to localStorage
        localStorage.setItem('token', newToken);
        
        // Set token in context and axios headers
        setToken(newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Extract user info from token since backend doesn't return it separately
        const userData = parseJwt(newToken);
        
        // Update state
        setUser(userData);
        setIsAuthenticated(true);
      }

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      setError(
        error.response?.data?.message || 
        'Registration failed. Please try again with different credentials.'
      );
      return false;
    }
  };

  // Logout function with improved cleanup
  const logout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    
    // Clear token from axios headers
    delete axios.defaults.headers.common['Authorization'];
    
    // Reset state
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        loading,
        error,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};