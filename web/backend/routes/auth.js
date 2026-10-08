const { requireAdmin } = require('../auth/firebaseToken');
const { sendJson } = require('../http/respond');

async function handleAuth(req, res, pathname) {
  if (req.method !== 'GET') return false;
  if (pathname !== '/api/auth/me') return false;

  const user = await requireAdmin(req);
  sendJson(res, 200, { success: true, user });
  return true;
}

module.exports = { handleAuth };
