const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_ADMIN_SECRET',
  'GOOGLE_CLIENT_ID',
  'ADMIN_ROOT_USERNAME',
  'ADMIN_ROOT_PASSWORD',
];

const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  ADMIN_ROOT_USERNAME: process.env.ADMIN_ROOT_USERNAME,
  ADMIN_ROOT_PASSWORD: process.env.ADMIN_ROOT_PASSWORD,
  STUDENT_FRONTEND_URL: process.env.STUDENT_FRONTEND_URL || 'http://localhost:3000',
  ADMIN_FRONTEND_URL: process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
};
