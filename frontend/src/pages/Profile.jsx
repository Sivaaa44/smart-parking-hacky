import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Profile = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
        
        <div className="mb-6">
          <p className="text-gray-600 text-sm mb-1">Email</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 text-sm mb-1">Member Since</p>
          <p className="font-medium">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        
        <div className="border-t pt-6">
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
