/**
 * Date and Time utilities for slot-based booking.
 * Dynamically reads schedule from SystemSettings in the database.
 */
const SystemSettings = require('../models/SystemSettings');

// Cache settings for 30 seconds to avoid DB lookup on every request
let _cachedSettings = null;
let _cacheExpiry = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getScheduleSettings() {
  const now = Date.now();
  if (_cachedSettings && now < _cacheExpiry) {
    return _cachedSettings;
  }
  _cachedSettings = await SystemSettings.getSettings();
  _cacheExpiry = now + CACHE_TTL;
  return _cachedSettings;
}

/**
 * Invalidate the settings cache (call after admin updates settings).
 */
function invalidateSettingsCache() {
  _cachedSettings = null;
  _cacheExpiry = 0;
}

/**
 * Helper to get the current time components in IST.
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
function getAbsoluteTimeForIST(hour, minute, isNextDay = false) {
  const istNow = getISTParts(new Date());
  const pad = (n) => n.toString().padStart(2, '0');
  const isoString = `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}T${pad(hour)}:${pad(minute)}:00.000+05:30`;
  const date = new Date(isoString);
  if (isNextDay) {
    date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
  }
  return date;
}

/**
 * Generate time slots dynamically from a schedule config.
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @param {number} slotDuration - minutes
 * @returns {Array} Array of slot objects
 */
function generateSlots(startTime, endTime, slotDuration) {
  if (slotDuration <= 0) return [];
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startTotalMinutes = startH * 60 + startM;
  let endTotalMinutes = endH * 60 + endM;
  
  if (endTotalMinutes <= startTotalMinutes) {
    endTotalMinutes += 24 * 60; // Crosses midnight
  }

  const formatTime = (h, m) => {
    const normalizedH = h % 24;
    const isPM = normalizedH >= 12;
    const displayH = normalizedH > 12 ? normalizedH - 12 : (normalizedH === 0 ? 12 : normalizedH);
    const displayM = m.toString().padStart(2, '0');
    const ampm = isPM ? 'PM' : 'AM';
    return `${displayH}:${displayM} ${ampm}`;
  };

  const slots = [];
  let currentMinutes = startTotalMinutes;

  while (currentMinutes + slotDuration <= endTotalMinutes) {
    const slotStartH = Math.floor(currentMinutes / 60) % 24;
    const slotStartM = currentMinutes % 60;
    const slotEndMinutes = currentMinutes + slotDuration;
    const slotEndH = Math.floor(slotEndMinutes / 60) % 24;
    const slotEndM = slotEndMinutes % 60;

    const isNextDayStart = currentMinutes >= 24 * 60;
    const isNextDayEnd = slotEndMinutes >= 24 * 60;

    const pad = (n) => n.toString().padStart(2, '0');

    slots.push({
      id: `${pad(slotStartH)}:${pad(slotStartM)}-${pad(slotEndH)}:${pad(slotEndM)}`,
      label: `${formatTime(slotStartH, slotStartM)} - ${formatTime(slotEndH, slotEndM)}`,
      startHour: slotStartH,
      startMin: slotStartM,
      endHour: slotEndH,
      endMin: slotEndM,
      isNextDayStart,
      isNextDayEnd
    });

    currentMinutes = slotEndMinutes;
  }

  return slots;
}

/**
 * Map JS day-of-week (0=Sun) to day name.
 */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Get the schedule config for today (checks exceptions first, then weekly schedule).
 * @returns {Promise<{startTime: string, endTime: string, slotDuration: number, isClosed: boolean}>}
 */
async function getTodaySchedule() {
  const settings = await getScheduleSettings();
  const now = new Date();
  const istNow = getISTParts(now);
  const pad = (n) => n.toString().padStart(2, '0');
  const todayStr = `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}`;

  // Check exceptions first
  const exception = settings.exceptions?.find(e => e.date === todayStr);
  if (exception) {
    return {
      startTime: exception.startTime,
      endTime: exception.endTime,
      slotDuration: exception.slotDuration,
      isClosed: !!exception.isClosed,
    };
  }

  // Fall back to weekly schedule
  const dateInIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dayOfWeek = dateInIST.getDay(); // 0 = Sunday
  const dayName = DAY_NAMES[dayOfWeek];
  const dayConfig = settings.weeklySchedule[dayName];

  return {
    startTime: dayConfig.startTime,
    endTime: dayConfig.endTime,
    slotDuration: dayConfig.slotDuration,
    isClosed: !!dayConfig.isClosed,
  };
}

/**
 * Get all available slots for today that are in the future.
 * @returns {Promise<{date: string, slots: Array}>}
 */
async function getFutureSlotsForToday() {
  const now = new Date();
  const schedule = await getTodaySchedule();

  const istNow = getISTParts(now);
  const pad = (n) => n.toString().padStart(2, '0');
  const todayStr = `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}`;

  if (schedule.isClosed) {
    return { date: todayStr, slots: [] };
  }

  const allSlots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);

  const futureSlots = allSlots.filter(slot => {
    const slotEndTime = getAbsoluteTimeForIST(slot.endHour, slot.endMin, slot.isNextDayEnd);
    return slotEndTime > now;
  });

  return {
    date: todayStr,
    slots: futureSlots,
  };
}

/**
 * Get slot by ID for today and return absolute Date objects for start and end.
 * @returns {Promise<Object|null>}
 */
async function getSlotDetails(slotId) {
  const schedule = await getTodaySchedule();
  if (schedule.isClosed) return null;

  const allSlots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return null;

  const startTime = getAbsoluteTimeForIST(slot.startHour, slot.startMin, slot.isNextDayStart);
  const endTime = getAbsoluteTimeForIST(slot.endHour, slot.endMin, slot.isNextDayEnd);

  const now = new Date();
  const istNow = getISTParts(now);
  const pad = (n) => n.toString().padStart(2, '0');

  return {
    ...slot,
    startTime,
    endTime,
    dateString: `${istNow.year}-${pad(istNow.month)}-${pad(istNow.day)}`,
  };
}

module.exports = {
  getFutureSlotsForToday,
  getSlotDetails,
  getTodaySchedule,
  generateSlots,
  invalidateSettingsCache,
  getISTParts,
  getAbsoluteTimeForIST,
};
