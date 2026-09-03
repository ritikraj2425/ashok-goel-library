const { OAuth2Client } = require('google-auth-library');
const env = require('./env');

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and return the payload.
 * Throws if the token is invalid or not issued for our client.
 */
async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email_verified) {
    throw new Error('Email not verified by Google');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
  };
}

module.exports = { verifyGoogleToken };
