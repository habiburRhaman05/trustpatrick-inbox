// Express app definition — no app.listen() here so this same module can be
// used both by the local dev server (server/index.js) and by the Vercel
// serverless entry (api/index.js).

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const settings = require('./settingsStore');
const ghl = require('./ghlClient');
const auth = require('./auth');

const app = express();

// Railway (like most PaaS) terminates TLS at a proxy in front of the app and
// forwards plain HTTP internally. Trusting the proxy makes req.protocol/IP
// and the secure-cookie logic below see the real (https) request.
app.set('trust proxy', 1);

// Plain root route so hitting the bare Railway URL (or a healthcheck pointed
// at "/") gets a 200 instead of a 404.
app.get('/', (req, res) => res.json({ ok: true, service: 'positive-replies-server' }));

// ALLOWED_ORIGINS restricts which frontends may call this API with
// credentials (cookies). Comma-separated list, e.g.
// "https://myapp.vercel.app,https://myapp.com". If unset, any origin is
// reflected back (fine for local dev; set it once you deploy the frontend).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ["https://trustpatrick-inbox.vercel.app","http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Wrap async route handlers so thrown errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Every GHL-backed route needs credentials saved first.
function requireSettings(req, res, next) {
  const s = settings.load();
  if (!s.locationId || !s.token) {
    return res.status(400).json({ error: 'GHL is not connected yet. Save your Location ID and Private Integration Token in Settings first.' });
  }
  req.ghl = s;
  next();
}

// ---- Auth -----------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!auth.checkCredentials(email, password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  auth.issueSessionCookie(res);
  res.json({ email: auth.ACCOUNT.email });
});

app.post('/api/auth/logout', (req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const session = auth.getSession(req);
  if (!session) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ email: session.email, expiresAt: session.exp });
});

// Health check — public, no auth. Used by Railway (and load balancers in
// general) to know the process is up; must never require a session cookie.
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Everything below requires a valid session.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return auth.requireAuth(req, res, next);
});

// ---- Connection status (read-only) --------------------------------------
//
// GHL credentials are hardcoded via env vars (see settingsStore.js), so this
// endpoint is purely informational — the save/clear endpoints are gone and
// clients cannot supply their own Location ID or token.

app.get('/api/settings', (req, res) => {
  res.json(settings.publicView());
});

// ---- Contacts (filtered by tag) ----------------------------------------

app.get('/api/contacts', requireSettings, asyncHandler(async (req, res) => {
  const tag = req.query.tag || 'positive-replied';
  const contacts = await ghl.getContactsByTag(req.ghl.locationId, req.ghl.token, tag);
  res.json({ contacts });
}));

// Full record for one contact — backs the "View info" panel in the thread
// header, and fills in fields (phone especially) the search result omits.
app.get('/api/contacts/:id', requireSettings, asyncHandler(async (req, res) => {
  const contact = await ghl.getContact(req.ghl.token, req.params.id);
  res.json({ contact });
}));

// ---- Conversations -------------------------------------------------------

// Find (or create) the conversation for a contact, then return it.
app.get('/api/conversations', requireSettings, asyncHandler(async (req, res) => {
  const { contactId } = req.query;
  if (!contactId) return res.status(400).json({ error: 'contactId is required.' });

  let conversations = await ghl.searchConversations(req.ghl.locationId, req.ghl.token, contactId);

  if (!conversations.length) {
    const created = await ghl.createConversation(req.ghl.token, {
      locationId: req.ghl.locationId,
      contactId,
    });
    conversations = [created];
  }

  res.json({ conversations });
}));

app.get('/api/conversations/:id', requireSettings, asyncHandler(async (req, res) => {
  const conversation = await ghl.getConversation(req.ghl.token, req.params.id);
  res.json({ conversation });
}));

app.put('/api/conversations/:id', requireSettings, asyncHandler(async (req, res) => {
  const conversation = await ghl.updateConversation(req.ghl.token, req.params.id, req.body || {});
  res.json({ conversation });
}));

app.get('/api/conversations/:id/messages', requireSettings, asyncHandler(async (req, res) => {
  const messages = await ghl.getMessages(req.ghl.token, req.params.id);
  res.json({ messages });
}));

// ---- Reply (send SMS) ---------------------------------------------------

app.post('/api/conversations/:id/reply', requireSettings, asyncHandler(async (req, res) => {
  const { contactId, message, toNumber, fromNumber } = req.body || {};
  if (!contactId || !message || !String(message).trim()) {
    return res.status(400).json({ error: 'contactId and a message body are required.' });
  }

  const result = await ghl.sendSmsReply(req.ghl.token, {
    locationId: req.ghl.locationId,
    conversationId: req.params.id,
    contactId,
    message: String(message).trim(),
    toNumber,
    fromNumber,
  });

  res.json({ result });
}));

// ---- Errors ---------------------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  console.error(`[error] ${req.method} ${req.path} ->`, err.message);
  res.status(status).json({
    error: err.message || 'Something went wrong talking to GoHighLevel.',
    details: err.details,
  });
});

module.exports = app;
