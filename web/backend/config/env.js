const fs = require('fs');
const path = require('path');

function readEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;

  const text = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

const backendEnv = readEnvFile(path.join(__dirname, '..', '.env'));
const frontendEnv = readEnvFile(path.join(__dirname, '..', '..', 'frontend', '.env'));

function env(name, fallback = '') {
  return process.env[name] ?? backendEnv[name] ?? frontendEnv[name] ?? fallback;
}

const port = Number(env('PORT', '5000'));
const firebaseWebApiKey = env('FIREBASE_WEB_API_KEY', env('VITE_FIREBASE_API_KEY'));
const allowedOrigins = String(
  env(
    'FRONTEND_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173',
  ),
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  port: Number.isFinite(port) ? port : 5000,
  firebaseWebApiKey,
  allowedOrigins,
};
