/**
 * Input normalization utilities.
 * Ensures consistent data storage for enrollment numbers and phone numbers.
 */

/**
 * Normalize enrollment number:
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Convert to uppercase
 */
function normalizeEnrollment(enrollment) {
  if (!enrollment || typeof enrollment !== 'string') return '';
  return enrollment.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Normalize phone number:
 * - Remove all non-digit characters
 * - Trim whitespace
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim().replace(/[^0-9+]/g, '');
}

/**
 * Normalize name:
 * - Trim whitespace
 * - Collapse multiple spaces
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

module.exports = {
  normalizeEnrollment,
  normalizePhone,
  normalizeName,
};
