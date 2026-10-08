const { firebaseWebApiKey } = require('../config/env');

function authError(code, message, statusCode = 401) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function lookupFirebaseUser(idToken) {
  if (!firebaseWebApiKey) {
    throw authError(
      'server/firebase-not-configured',
      'Firebase API configuration is missing.',
      503,
    );
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseWebApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  const data = await response.json().catch(() => ({}));
  const record = Array.isArray(data.users) ? data.users[0] : null;

  if (!response.ok || !record) {
    throw authError(
      'auth/invalid-session',
      'Administrator session is invalid or expired.',
    );
  }

  return {
    uid: record.localId,
    email: record.email || null,
    name: record.displayName || null,
    emailVerified: Boolean(record.emailVerified),
    role: 'admin',
  };
}

async function requireAdmin(req) {
  const token = getBearerToken(req);

  if (!token) {
    throw authError(
      'auth/missing-token',
      'Administrator authentication is required.',
    );
  }

  const user = await lookupFirebaseUser(token);

  if (!user.emailVerified) {
    throw authError(
      'auth/email-not-verified',
      'Verify your email before using the Admin API.',
      403,
    );
  }

  return user;
}

module.exports = { requireAdmin };
