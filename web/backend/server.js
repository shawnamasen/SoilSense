const http = require('http');
const { port, firebaseWebApiKey } = require('./config/env');
const { applyCors } = require('./http/cors');
const { sendJson } = require('./http/respond');
const { routeRequest } = require('./router');

const server = http.createServer(async (req, res) => {
  try {
    if (!applyCors(req, res)) return;
    await routeRequest(req, res);
  } catch (error) {
    console.error('SoilSense API error:', error?.code || error?.message || error);

    sendJson(res, error?.statusCode || 500, {
      success: false,
      code: error?.code || 'server/error',
      error: error?.message || 'Internal server error.',
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('==========================================');
  console.log('  SoilSense Admin API');
  console.log('==========================================');
  console.log(`API: http://localhost:${port}`);
  console.log(`Firebase config found: ${firebaseWebApiKey ? 'Yes' : 'No'}`);
  console.log('No backend npm install is required.');
  console.log('');
});
