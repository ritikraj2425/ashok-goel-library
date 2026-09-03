/**
 * Email validation utilities.
 * Enforces that only rishihood.edu.in domain emails are allowed.
 */

/**
 * Validates that an email belongs to the rishihood.edu.in domain.
 * Accepts:
 *   - abc@rishihood.edu.in
 *   - abc@nst.rishihood.edu.in
 *   - abc@school.rishihood.edu.in
 * Rejects:
 *   - abc@gmail.com
 *   - abc@rishihood.edu.in.fake.com
 *   - abc@rishihood.edu.com
 */
function isValidCollegeEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const normalized = email.trim().toLowerCase();

  // Pattern: localpart@(optional-subdomains.)rishihood.edu.in
  // The $ anchor ensures nothing comes after .edu.in
  const pattern = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*rishihood\.edu\.in$/;
  return pattern.test(normalized);
}

module.exports = { isValidCollegeEmail };
