const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
    });
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Don't exit process in serverless
    if (env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
}

module.exports = connectDB;
