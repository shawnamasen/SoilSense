const { firebaseWebApiKey } = require('../config/env');
const { sendJson } = require('../http/respond');

function handleHealth(req, res, pathname) {
  if (req.method !== 'GET') return false;
  if (pathname !== '/health' && pathname !== '/api/health') return false;

  sendJson(res, 200, {
    success: true,
    service: 'SoilSense Admin API',
    firebaseConfigured: Boolean(firebaseWebApiKey),
    timestamp: new Date().toISOString(),
  });

  return true;
}

module.exports = { handleHealth };
