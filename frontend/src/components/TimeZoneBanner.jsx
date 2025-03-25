import React from 'react';
import { useTimeZone } from '../hooks/useTimeZone';

const TimeZoneBanner = () => {
  const { istTime, localTime } = useTimeZone();
  
  return (
    <div className="bg-blue-50 p-2 text-xs border-b border-blue-100 flex justify-between items-center">
      <div>
        <span className="font-semibold">Your Local Time:</span> {localTime}
      </div>
      <div>
        <span className="font-semibold">IST Time:</span> {istTime}
      </div>
      <div className="text-gray-500">
        All bookings use Indian Standard Time (IST)
      </div>
    </div>
  );
};

export default TimeZoneBanner; 