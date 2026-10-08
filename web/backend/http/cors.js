const { allowedOrigins } = require('../config/env');
const { sendJson } = require('./respond');

const allowed = new Set(allowedOrigins);

function applyCors(req, res) {
  const origin = req.headers.origin;

  if (origin && !allowed.has(origin)) {
    sendJson(res, 403, {
      success: false,
      error: 'Request origin is not allowed.',
    });
    return false;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return false;
  }

  return true;
}

module.exports = { applyCors };
