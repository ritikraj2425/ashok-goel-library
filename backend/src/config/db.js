const mongoose = require('mongoose');
const env = require('./env');

// Reuse the connection cache across serverless invocations.
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

// Attach monitoring listeners once per runtime.
// Do not clear the connection cache on these events as Mongoose handles reconnection automatically.
if (!global.mongooseListenerAttached) {
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Waiting for reconnection...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  global.mongooseListenerAttached = true;
}

async function connectDB() {
  // Reuse existing connection.
  if (cached.conn) {
    return cached.conn;
  }

  // Create a single connection promise.
  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(env.MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;

    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

module.exports = connectDB;
