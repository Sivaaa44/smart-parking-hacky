import { useState } from 'react';
import { createPortal } from 'react-dom';

export function Sheet({ children, open, onOpenChange }) {
  if (!open) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange && onOpenChange(false)}
      />
      <div className="fixed inset-y-0 right-0 z-50 h-full w-3/4 max-w-sm bg-white p-6 shadow-lg">
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetTrigger({ children, onClick }) {
  return (
    <div onClick={onClick}>
      {children}
    </div>
  );
}

export function SheetContent({ children }) {
  return <div>{children}</div>;
}
