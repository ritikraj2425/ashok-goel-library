/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a consistent JSON response.
 */
function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }

  // Mongoose cast error (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Custom application errors with status code
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Generic server error
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message, 
    stack: env.NODE_ENV === 'development' ? err.stack : undefined 
  });
}

module.exports = errorHandler;
