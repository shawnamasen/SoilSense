const { requireAdmin } = require('../auth/firebaseToken');
const { sendJson } = require('../http/respond');

const resources = new Map([
  ['/api/farmers', 'farmers'],
  ['/api/devices', 'devices'],
  ['/api/readings', 'readings'],
  ['/api/support', 'support'],
  ['/api/reports', 'reports'],
  ['/api/business', 'business'],
]);

async function handleAdminData(req, res, pathname) {
  if (req.method !== 'GET' || !resources.has(pathname)) return false;

  await requireAdmin(req);
  const resource = resources.get(pathname);

  sendJson(res, 200, {
    success: true,
    connected: false,
    resource,
    items: [],
    message: `${resource} endpoint is ready for the real Firebase collection.`,
  });

  return true;
}

module.exports = { handleAdminData };
