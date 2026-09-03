const Cabin = require('../models/Cabin');
const Booking = require('../models/Booking');
const { ACTIVE_STATUSES } = require('../utils/constants');
const { runCleanup } = require('./cleanup.service');
const { getFutureSlotsForToday } = require('../utils/date.utils');

/**
 * Get all cabins with their current booking status for student view.
 * Does NOT expose private booking details to students.
 */
async function getCabinStatusForStudents() {
  await runCleanup();

  const cabins = await Cabin.find({ isActive: true }).sort({ code: 1 }).lean();
  
  const futureSlotsData = getFutureSlotsForToday();
  const validSlots = futureSlotsData.slots; // Array of slot objects
  const todayDateStr = futureSlotsData.date; // YYYY-MM-DD

  // Get all active bookings for today
  const activeBookings = await Booking.find({
    status: { $in: ACTIVE_STATUSES },
    bookingDate: todayDateStr
  })
    .select('cabinId timeSlotId status')
    .lean();

  // Map cabin ID to set of booked slot IDs and hold slot IDs
  const bookedSlotsByCabin = {};
  const holdSlotsByCabin = {};
  for (const booking of activeBookings) {
    const cid = booking.cabinId.toString();
    if (booking.status === 'pending') {
      if (!holdSlotsByCabin[cid]) holdSlotsByCabin[cid] = new Set();
      holdSlotsByCabin[cid].add(booking.timeSlotId);
    } else {
      if (!bookedSlotsByCabin[cid]) bookedSlotsByCabin[cid] = new Set();
      bookedSlotsByCabin[cid].add(booking.timeSlotId);
    }
  }

  return cabins.map((cabin) => {
    let displayStatus = 'available';
    const cid = cabin._id.toString();
    const bookedSlotIds = bookedSlotsByCabin[cid] || new Set();
    const holdSlotIds = holdSlotsByCabin[cid] || new Set();

    // Determine available slots and hold slots
    const availableSlots = validSlots.filter(s => !bookedSlotIds.has(s.id) && !holdSlotIds.has(s.id));
    const holdSlots = validSlots.filter(s => holdSlotIds.has(s.id));

    if (availableSlots.length === 0) {
      displayStatus = 'booked';
    }

    return {
      id: cabin._id,
      code: cabin.code,
      name: cabin.name,
      minPeople: cabin.minPeople,
      maxPeople: cabin.maxPeople,
      isActive: cabin.isActive,
      displayStatus,
      availableSlots,
      holdSlots,
    };
  });
}

/**
 * Get all cabins for admin view (full details).
 */
async function getAllCabins() {
  return Cabin.find().sort({ code: 1 }).lean();
}

/**
 * Create a new cabin (admin).
 */
async function createCabin(data) {
  if (data.minPeople > data.maxPeople) {
    const error = new Error('Minimum people cannot exceed maximum people');
    error.statusCode = 400;
    throw error;
  }

  const existing = await Cabin.findOne({ code: data.code.toUpperCase() });
  if (existing) {
    const error = new Error('Cabin with this code already exists');
    error.statusCode = 409;
    throw error;
  }

  return Cabin.create({
    code: data.code.toUpperCase(),
    name: data.name,
    minPeople: data.minPeople,
    maxPeople: data.maxPeople,
    isActive: data.isActive !== undefined ? data.isActive : true,
  });
}

/**
 * Update a cabin (admin).
 * Active bookings are not affected by capacity changes.
 */
async function updateCabin(cabinId, data) {
  const updateFields = {};

  if (data.code !== undefined) updateFields.code = data.code.toUpperCase();
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.minPeople !== undefined) updateFields.minPeople = data.minPeople;
  if (data.maxPeople !== undefined) updateFields.maxPeople = data.maxPeople;
  if (data.isActive !== undefined) updateFields.isActive = data.isActive;

  // Validate min/max if both are being updated or one is being updated
  if (updateFields.minPeople !== undefined || updateFields.maxPeople !== undefined) {
    const cabin = await Cabin.findById(cabinId);
    if (!cabin) {
      const error = new Error('Cabin not found');
      error.statusCode = 404;
      throw error;
    }

    const newMin = updateFields.minPeople !== undefined ? updateFields.minPeople : cabin.minPeople;
    const newMax = updateFields.maxPeople !== undefined ? updateFields.maxPeople : cabin.maxPeople;

    if (newMin > newMax) {
      const error = new Error('Minimum people cannot exceed maximum people');
      error.statusCode = 400;
      throw error;
    }
  }

  updateFields.updatedAt = new Date();

  const updated = await Cabin.findByIdAndUpdate(
    cabinId,
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  if (!updated) {
    const error = new Error('Cabin not found');
    error.statusCode = 404;
    throw error;
  }

  return updated;
}

/**
 * Delete a cabin (admin).
 */
async function deleteCabin(cabinId) {
  // Check if there are any active bookings for this cabin
  const activeBookings = await Booking.findOne({
    cabinId,
    status: { $in: ACTIVE_STATUSES },
  });

  if (activeBookings) {
    const error = new Error('Cannot delete cabin because it has active or upcoming bookings');
    error.statusCode = 400;
    throw error;
  }

  const deleted = await Cabin.findByIdAndDelete(cabinId);
  if (!deleted) {
    const error = new Error('Cabin not found');
    error.statusCode = 404;
    throw error;
  }

  return deleted;
}

module.exports = {
  getCabinStatusForStudents,
  getAllCabins,
  createCabin,
  updateCabin,
  deleteCabin,
};
