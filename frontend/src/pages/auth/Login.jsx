import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const Login = () => {
  const { login, isAuthenticated, error: authError } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Handle redirects
  useEffect(() => {
    // If we came from another page that requires auth, save that location
    const from = location.state?.from || '/';
    
    // If already authenticated, redirect to the saved location or home
    if (isAuthenticated) {
      navigate(from);
    }
    
    // Check for token expired query param
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('expired') === 'true') {
      setError('Your session has expired. Please log in again.');
    }
  }, [isAuthenticated, navigate, location]);
  
  // Update local error state when auth context error changes
  useEffect(() => {
    if (authError) {
      setError(authError);
      setLoading(false);
    }
  }, [authError]);
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Validate form
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }
    
    try {
      const success = await login(formData.email, formData.password);
      
      if (success) {
        // Redirect to the page they came from or home
        const from = location.state?.from || '/';
        navigate(from);
      }
    } catch (err) {
      // Error handling happens in authError useEffect
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Welcome Back</h2>
        <p className="text-gray-600 text-center mb-6">Sign in to your account</p>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@example.com"
              required
              autoComplete="email"
            />
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <a href="#" className="text-sm text-blue-600 hover:underline">Forgot password?</a>
            </div>
            <input
              type="password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:bg-blue-400"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-gray-600">
          Don't have an account? <Link to="/register" className="text-blue-600 hover:underline font-medium">Create Account</Link>
        </div>
      </div>
    </div>
  );
};

export default Login; 