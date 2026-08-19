// Single-tenant GHL credentials — hardcoded via environment variables.
//
// There is no client-facing "Connect" flow any more: the Location ID and the
// Private Integration Token are baked into the deployment's env vars, so the
// app is connected the moment it boots and every signed-in user shares the
// same GHL location.
//
// Local dev: server/.env (loaded by dotenv in app.js).
// Production: set the same vars in Railway / Vercel project settings.
//
// The canonical names are GHL_LOCATION_ID / GHL_PRIVATE_TOKEN. The extra
// fallbacks below cover the names already in use on existing deployments
// (including the LOACTION_ID typo) so nothing breaks on rollout.

// GHL credentials come exclusively from environment variables.
// On Vercel: set them in the project dashboard → Settings → Environment Variables.
// On Railway: set them in the service variables.
// For local dev: copy .env.example to .env and fill in the values.

const LOCATION_ID = (
  process.env.GHL_LOCATION_ID ||
  process.env.LOCATION_ID ||
  process.env.LOACTION_ID ||
  ''
).trim();

const TOKEN = (
  process.env.GHL_PRIVATE_TOKEN ||
  process.env.PRIVATE_TOKEN ||
  process.env.PRIVATETOKEN ||
  ''
).trim();

function load() {
  return { locationId: LOCATION_ID, token: TOKEN };
}

function isConfigured() {
  return Boolean(LOCATION_ID && TOKEN);
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '•'.repeat(token.length);
  return `${token.slice(0, 4)}${'•'.repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`;
}

// Safe-to-expose status. Never returns the raw token.
function publicView() {
  return {
    configured: isConfigured(),
    locationId: LOCATION_ID,
    tokenPreview: maskToken(TOKEN),
    hasToken: Boolean(TOKEN),
    managedByEnv: true,
  };
}

module.exports = { load, isConfigured, publicView };
