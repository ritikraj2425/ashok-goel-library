require('dotenv').config();
const mongoose = require('mongoose');
const { getAnalyticsBookings } = require('./src/services/analytics.service');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ashok-goel-library', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endDate = now.toISOString();

  const data = await getAnalyticsBookings(startDate, endDate, 'cancelled_by_student', 1, 20, '');
  console.log('Bookings:', data.bookings.length);
  
  mongoose.disconnect();
}
run();
