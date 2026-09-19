const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const cabinRoutes = require('./routes/cabin.routes');
const bookingRoutes = require('./routes/booking.routes');
const adminAuthRoutes = require('./routes/admin.auth.routes');
const adminDashboardRoutes = require('./routes/admin.dashboard.routes');
const adminBookingRoutes = require('./routes/admin.booking.routes');
const adminCabinRoutes = require('./routes/admin.cabin.routes');
const adminUserRoutes = require('./routes/admin.user.routes');
const adminStudentRoutes = require('./routes/admin.student.routes');
const adminAnalyticsRoutes = require('./routes/admin.analytics.routes');
const adminSettingsRoutes = require('./routes/admin.settings.routes');

const connectDB = require('./config/db');

const app = express();

// Initialize DB connection middleware for serverless environments (Vercel)
app.use((req, res, next) => {
  connectDB().then(() => next()).catch(next);
});

// --- Security middleware ---
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  env.STUDENT_FRONTEND_URL,
  env.ADMIN_FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001'
].filter(Boolean);
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin && env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      const isAllowed = allowedOrigins.some(allowedUrl => {
        if (!allowedUrl) return false;
        // Normalize by removing trailing slashes
        const normalizedAllowed = allowedUrl.replace(/\/$/, '');
        const normalizedOrigin = origin ? origin.replace(/\/$/, '') : '';
        return normalizedAllowed === normalizedOrigin;
      });

      if (isAllowed || !origin) {
        callback(null, true);
      } else {
        const err = new Error(`CORS blocked: Origin '${origin}' is not in allowed origins: ${allowedOrigins.join(', ')}`);
        err.statusCode = 403;
        callback(err);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// --- Body parsing ---
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Request logging ---
if (env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// --- Rate limiting ---
app.use(generalLimiter);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Student routes ---
app.use('/api/auth', authRoutes);
app.use('/api/cabins', cabinRoutes);
app.use('/api/bookings', bookingRoutes);

// --- Admin routes ---
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/cabins', adminCabinRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- Global error handler ---
app.use(errorHandler);

module.exports = app;
