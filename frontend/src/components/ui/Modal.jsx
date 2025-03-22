import React from 'react';

const Modal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        <div className="px-6 py-4">
          {children}
        </div>
        
        {actions && (
          <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-2 rounded-b-lg">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal; 