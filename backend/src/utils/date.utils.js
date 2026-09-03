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
 * Get all available slots for today that are in the future
 * @returns {Array} List of available slots
 */
function getFutureSlotsForToday() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday
  
  const allSlots = dayOfWeek === 0 ? SUN_SLOTS : MON_SAT_SLOTS;
  
  // Filter slots that have not yet started.
  // We'll require the start time to be in the future (or within some tolerance)
  // Let's say if it's 10:15, the 10:30 slot is available, but the 9:30 slot is not.
  // If it's 10:35, the 10:30 slot is no longer available to book.
  
  const futureSlots = allSlots.filter(slot => {
    const slotEndTime = new Date();
    slotEndTime.setHours(slot.endHour, slot.endMin, 0, 0);
    return slotEndTime > now;
  });
  
  return {
    date: now.toISOString().split('T')[0], // YYYY-MM-DD
    slots: futureSlots
  };
}

/**
 * Get slot by ID for today and return absolute Date objects for start and end
 */
function getSlotDetails(slotId) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const allSlots = dayOfWeek === 0 ? SUN_SLOTS : MON_SAT_SLOTS;
  
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return null;
  
  const startTime = new Date();
  startTime.setHours(slot.startHour, slot.startMin, 0, 0);
  
  const endTime = new Date();
  endTime.setHours(slot.endHour, slot.endMin, 0, 0);
  
  return {
    ...slot,
    startTime,
    endTime,
    dateString: now.toISOString().split('T')[0]
  };
}

module.exports = {
  getFutureSlotsForToday,
  getSlotDetails,
  MON_SAT_SLOTS,
  SUN_SLOTS
};
