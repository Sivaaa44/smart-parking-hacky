// Frontend utility for date/time handling

// Convert any date to IST for display
export const formatToIST = (date) => {
  if (!date) return '';
  
  const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  
  return new Date(date).toLocaleString('en-IN', options);
};

// Format time only to IST (HH:MM)
export const formatTimeToIST = (date) => {
  if (!date) return '';
  
  const options = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  
  return new Date(date).toLocaleString('en-IN', options);
};

// Convert to local format for input fields
export const formatForDateTimeInput = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Get current date/time in IST
export const getCurrentIST = () => {
  const now = new Date();
  
  // Get IST offset (5 hours 30 minutes ahead of UTC)
  const istOffset = 330; // minutes
  
  // Adjust date: UTC + 5:30
  const istTime = new Date(now.getTime() + (istOffset * 60000));
  
  return istTime;
};

// Get nearest hour in IST (rounded up)
export const getNearestHourIST = () => {
  const ist = getCurrentIST();
  
  // Round up to next hour
  ist.setHours(ist.getHours() + 1);
  ist.setMinutes(0, 0, 0);
  
  return ist;
};

// Check if a time is in the past (IST)
export const isInPastIST = (date) => {
  const istNow = getCurrentIST();
  const dateToCheck = new Date(date);
  
  return dateToCheck < istNow;
}; 