const mongoose = require('mongoose');
const env = require('./src/config/env');
const { runCleanup } = require('./src/services/cleanup.service');
const Booking = require('./src/models/Booking');

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  
  console.log("Running cleanup...");
  await runCleanup();
  
  const awaitingBookings = await Booking.find({ status: 'awaiting_checkin' });
  console.log("Awaiting check-in:", awaitingBookings.length);
  
  const noShowBookings = await Booking.find({ status: 'no_show' });
  console.log("No show:", noShowBookings.length);
  
  mongoose.disconnect();
}
main();
