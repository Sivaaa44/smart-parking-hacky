const moment = require('moment-timezone');

const dateUtils = {
  // Convert any date to IST format
  toIST: (date) => {
    return moment(date).tz('Asia/Kolkata');
  },
  
  // Format date to IST display string
  formatDateTime: (date) => {
    return moment(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
  },
  
  // Get current time in IST
  getNowIST: () => {
    return moment().tz('Asia/Kolkata');
  },

  // Get available time slots for today or specific date in IST
  getTimeSlots: (date = null) => {
    const slots = [];
    // Start with current hour in IST, rounded up to next hour
    const now = moment().tz('Asia/Kolkata');
    
    // If specific date provided, use that date with start of day
    // Otherwise use current time rounded to next hour
    const startTime = date ? 
      moment(date).tz('Asia/Kolkata').startOf('day') : 
      moment().tz('Asia/Kolkata').add(1, 'hour').startOf('hour');
      
    const endTime = moment(startTime).endOf('day');

    let currentSlot = moment(startTime);

    while (currentSlot.isBefore(endTime)) {
      slots.push({
        startTime: currentSlot.toISOString(),
        endTime: moment(currentSlot).add(1, 'hour').toISOString(),
        availableSlotCount: 0,
        formattedStartTime: currentSlot.format('HH:mm'), // Add formatted time for UI
        formattedEndTime: moment(currentSlot).add(1, 'hour').format('HH:mm')
      });
      currentSlot.add(1, 'hour');
    }
    return slots;
  },

  // Check if two time periods overlap
  isOverlapping: (start1, end1, start2, end2) => {
    const s1 = moment(start1).tz('Asia/Kolkata');
    const e1 = moment(end1).tz('Asia/Kolkata');
    const s2 = moment(start2).tz('Asia/Kolkata');
    const e2 = moment(end2).tz('Asia/Kolkata');
    return s1.isBefore(e2) && e1.isAfter(s2);
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