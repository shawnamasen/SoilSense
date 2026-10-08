const { sendJson } = require('./http/respond');
const { handleHealth } = require('./routes/health');
const { handleAuth } = require('./routes/auth');
const { handleAdminData } = require('./routes/adminData');
const { handleDevice } = require('./routes/device');

async function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (handleHealth(req, res, pathname)) return;
  if (await handleAuth(req, res, pathname)) return;
  if (await handleAdminData(req, res, pathname)) return;
  if (handleDevice(req, res, pathname)) return;

  sendJson(res, 404, {
    success: false,
    error: 'Route not found.',
  });
}

module.exports = { routeRequest };
