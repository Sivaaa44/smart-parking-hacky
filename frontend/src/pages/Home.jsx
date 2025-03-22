import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="flex flex-col min-h-full">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-500 text-white flex-1 flex flex-col justify-center items-center text-center px-4 py-16 md:py-32">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Find and Book Parking in Chennai
          </h1>
          <p className="text-xl md:text-2xl mb-10 text-blue-100 max-w-2xl mx-auto">
            Discover available parking spots in real-time and reserve your space before you arrive.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/map" className="px-8 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors shadow-lg transform hover:-translate-y-1 duration-200">
              Find Parking
            </Link>
            <Link to="/register" className="px-8 py-3 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition-colors shadow-lg border border-blue-400 transform hover:-translate-y-1 duration-200">
              Sign Up
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-800">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600 font-bold text-xl">1</div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Find a Spot</h3>
              <p className="text-gray-600">Search for available parking spots near your destination on our interactive map.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600 font-bold text-xl">2</div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Book a Space</h3>
              <p className="text-gray-600">Reserve your parking spot in advance with just a few clicks and secure your space.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600 font-bold text-xl">3</div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Park with Ease</h3>
              <p className="text-gray-600">Arrive at your reserved spot and enjoy hassle-free parking with no surprises.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to park smarter?</h2>
          <p className="text-xl text-gray-300 mb-8">Join thousands of drivers who save time and reduce stress with ParkSmart.</p>
          <Link to="/map" className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg">
            Get Started Now
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;