import { useState, useEffect } from 'react';

export const useTimeZone = () => {
  const [istTime, setIstTime] = useState('');
  const [localTime, setLocalTime] = useState('');
  
  const updateTimes = () => {
    const now = new Date();
    
    // Get IST time
    const istTimeStr = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Get local browser time
    const localTimeStr = now.toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    setIstTime(istTimeStr);
    setLocalTime(localTimeStr);
  };
  
  useEffect(() => {
    // Update immediately
    updateTimes();
    
    // Then update every second
    const timer = setInterval(updateTimes, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format any date to IST
  const formatToIST = (date) => {
    if (!date) return '';
    
    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  // Format for input fields (which expect local time)
  const formatForInput = (date) => {
    if (!date) return '';
    
    const d = new Date(date);
    // Adjust for timezone offset
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  
  // Parse from input and convert to ISO format
  const parseFromInput = (inputValue) => {
    if (!inputValue) return null;
    
    // Create a date from the input value (browser handles local timezone)
    const date = new Date(inputValue);
    return date.toISOString();
  };
  
  return {
    istTime,
    localTime,
    formatToIST,
    formatForInput,
    parseFromInput
  };
};
