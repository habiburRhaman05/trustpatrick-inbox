// Local dev / traditional Node hosting entry point.
// On Vercel, api/index.js imports server/app.js directly instead of this file.

const app = require('./app');
const settings = require('./settingsStore');

const PORT = process.env.PORT || 4000;

// ── Startup validation ──────────────────────────────────────────────────
const warnings = [];
if (!process.env.LOGIN_EMAIL || !process.env.LOGIN_PASSWORD) {
  warnings.push('LOGIN_EMAIL and/or LOGIN_PASSWORD are not set — login will not work.');
}
if (!settings.isConfigured()) {
  warnings.push('GHL credentials not found. Set GHL_LOCATION_ID & GHL_PRIVATE_TOKEN in env vars or data/settings.json.');
}
if (!process.env.AUTH_SECRET) {
  warnings.push('AUTH_SECRET not set — using insecure dev default. Set it for production.');
}
if (warnings.length) {
  console.warn('\n⚠  Startup warnings:');
  warnings.forEach((w) => console.warn('   • ' + w));
  console.warn('');
}

app.listen(PORT, () => {
  console.log(`Positive Replies backend listening on http://localhost:${PORT}`);
});
