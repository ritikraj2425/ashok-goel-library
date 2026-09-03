const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const { startCleanupInterval } = require('./src/services/cleanup.service');
const { TIMING } = require('./src/utils/constants');

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Start cleanup interval (every 60 seconds)
  const cleanupIntervalId = startCleanupInterval(TIMING.CLEANUP_INTERVAL_MS);

  // Start HTTP server
  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    clearInterval(cleanupIntervalId);
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
