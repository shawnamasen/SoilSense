const { sendJson } = require('../http/respond');

function handleDevice(req, res, pathname) {
  if (req.method !== 'POST') return false;

  if (
    pathname !== '/api/device/heartbeat' &&
    pathname !== '/api/device/readings'
  ) {
    return false;
  }

  sendJson(res, 501, {
    success: false,
    ready: false,
    error:
      'Endpoint reserved until SoilSense device authentication and the live device payload are finalized.',
  });

  return true;
}

module.exports = { handleDevice };
