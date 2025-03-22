const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-6">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm">&copy; {new Date().getFullYear()} ParkSmart - Chennai Parking Solution</p>
        <p className="text-xs text-gray-400 mt-2">Find and reserve parking spots in Chennai</p>
      </div>
    </footer>
  );
};

export default Footer;