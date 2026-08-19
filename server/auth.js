// Single hardcoded-account auth with a signed, stateless session token
// (HMAC-signed, expiry embedded in the payload) so it works identically on
// a normal long-running Node process and on stateless serverless functions
// (Vercel) — no server-side session store needed.

const crypto = require('crypto');

const SESSION_DAYS = 3;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'pr_session';

// Override via env vars in production; these defaults match what was asked for.
const ACCOUNT = {
  email: (process.env.LOGIN_EMAIL || '').toLowerCase(),
  password: process.env.LOGIN_PASSWORD || '',
};

// AUTH_SECRET should be set in production (Vercel env vars). Falls back to a
// dev-only secret so local `npm run dev` works out of the box.
const SECRET = process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function checkCredentials(email, password) {
  return (
    typeof email === 'string' &&
    typeof password === 'string' &&
    email.trim().toLowerCase() === ACCOUNT.email &&
    password === ACCOUNT.password
  );
}

function issueSessionCookie(res) {
  const token = sign({ email: ACCOUNT.email, exp: Date.now() + SESSION_MS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',   // required — frontend and backend are on different Vercel subdomains
    secure: true,        // required by browsers when sameSite is 'none'
    maxAge: SESSION_MS,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const session = verify(token);
  if (!session) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  req.session = session;
  next();
}

function getSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  return verify(token);
}

module.exports = {
  COOKIE_NAME,
  ACCOUNT,
  checkCredentials,
  issueSessionCookie,
  clearSessionCookie,
  requireAuth,
  getSession,
};
