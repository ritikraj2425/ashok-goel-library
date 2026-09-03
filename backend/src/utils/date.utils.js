/**
 * Date and Time utilities for slot-based booking
 */

// Generate slots for Monday to Saturday
const generateMonSatSlots = () => {
  const slots = [];
  let currentHour = 9;
  let currentMin = 30;
  
  while (currentHour < 21 || (currentHour === 21 && currentMin === 30)) {
    const startHour = currentHour;
    const startMin = currentMin;
    
    let endHour = startHour + 1;
    let endMin = startMin;
    
    const formatTime = (h, m) => {
      const isPM = h >= 12;
      const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const displayM = m.toString().padStart(2, '0');
      const ampm = isPM ? 'PM' : 'AM';
      return `${displayH}:${displayM} ${ampm}`;
    };
    
    const startTimeStr = formatTime(startHour, startMin);
    const endTimeStr = formatTime(endHour, endMin);
    
    // Parse times for today to get absolute Date objects
    slots.push({
      id: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}-${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
      label: `${startTimeStr} - ${endTimeStr}`,
      startHour,
      startMin,
      endHour,
      endMin
    });
    
    currentHour = endHour;
    currentMin = endMin;
  }
  return slots;
};

// Generate slots for Sunday
const generateSunSlots = () => {
  const slots = [];
  for (let currentHour = 10; currentHour < 17; currentHour++) {
    const startHour = currentHour;
    const endHour = startHour + 1;
    
    const formatTime = (h, m) => {
      const isPM = h >= 12;
      const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const displayM = m.toString().padStart(2, '0');
      const ampm = isPM ? 'PM' : 'AM';
      return `${displayH}:${displayM} ${ampm}`;
    };
    
    slots.push({
      id: `${startHour.toString().padStart(2, '0')}:00-${endHour.toString().padStart(2, '0')}:00`,
      label: `${formatTime(startHour, 0)} - ${formatTime(endHour, 0)}`,
      startHour,
      startMin: 0,
      endHour,
      endMin: 0
    });
  }
  return slots;
};

const MON_SAT_SLOTS = generateMonSatSlots();
const SUN_SLOTS = generateSunSlots();

/**
 * Helper to get the current time components in IST
 */
function getISTParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parseInt(parts.find(p => p.type === type).value, 10);
  
  return {
    year: get('year'),
    month: get('month'), // 1-indexed
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Creates an absolute Date object for a specific hour and minute in IST today.
 */
function getAbsoluteTimeForIST(hour, minute) {
  const now = new Date();
  const istNow = getISTParts(now);
  
  // Create a Date treating the IST string as local time, but we must explicitly define the timezone
  // The easiest way is to construct the ISO string for IST and parse it
  const pad = (n) => n.toString().padStart(2, '0');
  const isoString = `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}T${pad(hour)}:${pad(minute)}:00.000+05:30`;
  
  return new Date(isoString);
}

/**
 * Get all available slots for today that are in the future
 * @returns {Object} List of available slots
 */
function getFutureSlotsForToday() {
  const now = new Date();
  
  // Need to get the day of the week in IST
  const dateInIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dayOfWeek = dateInIST.getDay(); // 0 is Sunday
  
  const allSlots = dayOfWeek === 0 ? SUN_SLOTS : MON_SAT_SLOTS;
  
  const futureSlots = allSlots.filter(slot => {
    // Get absolute time of the slot's end in IST
    const slotEndTime = getAbsoluteTimeForIST(slot.endHour, slot.endMin);
    return slotEndTime > now;
  });
  
  const istNow = getISTParts(now);
  const pad = (n) => n.toString().padStart(2, '0');
  
  return {
    date: `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}`, // YYYY-MM-DD in IST
    slots: futureSlots
  };
}

/**
 * Get slot by ID for today and return absolute Date objects for start and end
 */
function getSlotDetails(slotId) {
  const now = new Date();
  const dateInIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dayOfWeek = dateInIST.getDay();
  
  const allSlots = (dayOfWeek === 0) ? SUN_SLOTS : MON_SAT_SLOTS;
  
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return null;
  
  const startTime = getAbsoluteTimeForIST(slot.startHour, slot.startMin);
  const endTime = getAbsoluteTimeForIST(slot.endHour, slot.endMin);
  
  const istNow = getISTParts(now);
  const pad = (n) => n.toString().padStart(2, '0');
  
  return {
    ...slot,
    startTime,
    endTime,
    dateString: `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}`
  };
}

module.exports = {
  getFutureSlotsForToday,
  getSlotDetails,
  MON_SAT_SLOTS,
  SUN_SLOTS
};
