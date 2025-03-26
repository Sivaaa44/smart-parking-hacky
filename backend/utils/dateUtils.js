const moment = require('moment-timezone');

/**
 * Utility functions for handling dates, times, and IST timezone
 * Centralizes all date-related operations for consistency
 */
const dateUtils = {
  // Format any date to ISO string
  toISOString: (date) => {
    return date ? new Date(date).toISOString() : null;
  },
  
  // Get current time in IST
  getCurrentIST: () => {
    return moment().tz('Asia/Kolkata');
  },
  
  // Format date to IST display string
  formatToIST: (date) => {
    return moment(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
  },
  
  // Convert any time to IST moment object
  toISTMoment: (date) => {
    return moment(date).tz('Asia/Kolkata');
  },
  
  // Round up to the next hour in IST
  getNextHourIST: () => {
    const now = moment().tz('Asia/Kolkata');
    return now.add(1, 'hour').startOf('hour');
  },
  
  // Generate array of time slots for a day
  getTimeSlots: (date = null) => {
    // Start with current time in IST, rounded up to next hour
    const now = moment().tz('Asia/Kolkata');
    
    // If specific date provided, use that date with start of day
    // Otherwise use current time rounded to next hour
    const startTime = date ? 
      moment(date).tz('Asia/Kolkata').startOf('day') : 
      now.add(1, 'hour').startOf('hour');
      
    const endTime = moment(startTime).endOf('day');
    const slots = [];
    let currentSlot = moment(startTime);

    while (currentSlot.isBefore(endTime)) {
      slots.push({
        startTime: currentSlot.toISOString(),
        endTime: moment(currentSlot).add(1, 'hour').toISOString(),
        displayStartTime: currentSlot.format('HH:mm'),
        displayEndTime: moment(currentSlot).add(1, 'hour').format('HH:mm'),
        availableSlotCount: 0
      });
      currentSlot.add(1, 'hour');
    }
    return slots;
  },

  // Check if two time periods overlap
  isOverlapping: (start1, end1, start2, end2) => {
    const s1 = moment(start1);
    const e1 = moment(end1);
    const s2 = moment(start2);
    const e2 = moment(end2);
    return s1.isBefore(e2) && e1.isAfter(s2);
  },
  
  // Check if a time is in the past
  isInPast: (date) => {
    return moment(date).isBefore(moment());
  },
  
  // Parse and validate date string, return a proper Date object
  parseDate: (dateString) => {
    if (!dateString) throw new Error('Date string is required');
    
    // Handle both Date objects and strings
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    
    return date;
  },
  
  // Calculate duration between two times in hours
  getDurationHours: (startTime, endTime) => {
    const start = dateUtils.parseDate(startTime);
    const end = dateUtils.parseDate(endTime);
    
    return (end - start) / (1000 * 60 * 60);
  },

  // Format to local browser/device timezone (for frontend)
  formatToLocalTimezone: (isoString) => {
    return moment(isoString).format('YYYY-MM-DD HH:mm');
  },
  
  // Format for HTML datetime-local input (which expects local timezone)
  formatForDateTimeInput: (date) => {
    return moment(date).format('YYYY-MM-DDTHH:mm');
  },
  
  // Parse datetime-local input and convert to ISO with correct timezone handling
  parseFromDateTimeInput: (inputValue) => {
    return moment(inputValue).toISOString();
  },

  // Convert local time to UTC
  toUTC: (dateTime) => {
    return moment(dateTime).utc().format();
  },

  // Convert UTC to local time
  toLocal: (dateTime) => {
    return moment.utc(dateTime).local().format();
  }
};

module.exports = dateUtils; 