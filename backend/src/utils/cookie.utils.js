const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Set student auth token as HTTP-only cookie AND return it in the response body.
 */
function setStudentToken(res, user) {
  const payload = { userId: user._id.toString(), type: 'student' };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

  res.cookie('student_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
}

/**
 * Set admin auth token as HTTP-only cookie AND return it in the response body.
 */
function setAdminToken(res, admin) {
  const payload = { adminId: admin._id.toString(), role: admin.role, type: 'admin' };
  const token = jwt.sign(payload, env.JWT_ADMIN_SECRET, { expiresIn: '12h' });

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  });

  return token;
}

/**
 * Clear student auth cookie.
 */
function clearStudentToken(res) {
  res.clearCookie('student_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
  });
}

/**
 * Clear admin auth cookie.
 */
function clearAdminToken(res) {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
  });
}

module.exports = {
  setStudentToken,
  setAdminToken,
  clearStudentToken,
  clearAdminToken,
};
