const mongoose = require('mongoose');
const env = require('./src/config/env');
const { runCleanup } = require('./src/services/cleanup.service');
const Booking = require('./src/models/Booking');
const User = require('./src/models/User');

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  
  // Create a dummy user
  const user = await User.create({
    googleId: 'test_noshow_user',
    email: 'noshow@rishihood.edu.in',
    name: 'No Show Student'
  });
  
  // Create a dummy booking awaiting checkin with deadline in past
  const now = new Date();
  const pastDeadline = new Date(now.getTime() - 10000); // 10 seconds ago
  
  const booking = await Booking.create({
    cabinId: new mongoose.Types.ObjectId(), // Fake
    studentUserId: user._id,
    mainStudent: { name: 'No Show Student', enrollmentNumber: 'NS123', phoneNumber: '123' },
    peopleCount: 1,
    bookingDate: '2026-09-03',
    timeSlotId: '10:00-11:00',
    startTime: new Date(now.getTime() - 60000), // 1 min ago
    endTime: new Date(now.getTime() + 60000), // 1 min future
    status: 'awaiting_checkin',
    checkInDeadlineAt: pastDeadline
  });
  
  console.log("Running cleanup...");
  await runCleanup();
  
  const updatedUser = await User.findById(user._id);
  console.log("Blocked Until:", updatedUser.blockedUntil);
  
  const updatedBooking = await Booking.findById(booking._id);
  console.log("Booking Status:", updatedBooking.status);
  
  // Clean up
  await User.findByIdAndDelete(user._id);
  await Booking.findByIdAndDelete(booking._id);
  mongoose.disconnect();
}
main();
