const crypto = require('crypto');

const SESSION_COOKIE = 'gm_admin_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-session-secret';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return acc;
      acc[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
      return acc;
    }, {});
}

function createSessionToken(admin) {
  const payload = {
    username: admin.username,
    displayName: admin.displayName,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function readSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (sign(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return {
      username: payload.username,
      displayName: payload.displayName,
    };
  } catch {
    return null;
  }
}

function sessionCookie(token) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function clearSessionCookie() {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function attachSession(req, res, next) {
  req.admin = readSession(req);
  next();
}

function requireAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  return next();
}

module.exports = {
  attachSession,
  requireAdmin,
  createSessionToken,
  sessionCookie,
  clearSessionCookie,
};
