require('dotenv').config();
const mongoose = require('mongoose');
require('./src/models/Cabin');
require('./src/models/User');
const { getAnalyticsBookings, getAnalytics } = require('./src/services/analytics.service');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ashok-goel-library', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = now.toISOString();

  const data = await getAnalytics(startDate, endDate);
  console.log('Counts:', data.counts);
  
  if (data.counts.cancelled_by_student > 0) {
    const b = await getAnalyticsBookings(startDate, endDate, 'cancelled_by_student', 1, 20, '');
    console.log('Bookings for cancelled_by_student:', b.bookings.length);
  }
  
  mongoose.disconnect();
}
run();
