const moment = require('moment');

const dateUtils = {
  formatDateTime: (date) => {
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  },

  // Get available time slots for today or specific date
  getTimeSlots: (date = null) => {
    const slots = [];
    const startTime = date ? 
      moment(date).startOf('day') : 
      moment().startOf('hour');
    const endTime = moment(startTime).endOf('day');

    let currentSlot = moment(startTime);

    while (currentSlot.isBefore(endTime)) {
      slots.push({
        startTime: currentSlot.toISOString(),
        endTime: moment(currentSlot).add(1, 'hour').toISOString(),
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