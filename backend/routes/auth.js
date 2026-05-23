const express = require('express');
const { verifyAdmin } = require('../adminStore');
const { createSessionToken, sessionCookie, clearSessionCookie } = require('../auth');

const router = express.Router();

// Rate limiter simple en memoria: máx 5 intentos fallidos por IP en 15 minutos
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function getRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    return { count: 0, windowStart: now };
  }
  return entry;
}

function recordFailedAttempt(ip) {
  const entry = getRateLimit(ip);
  loginAttempts.set(ip, { count: entry.count + 1, windowStart: entry.windowStart });
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

router.get('/session', (req, res) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return res.json({ admin: req.admin });
});

router.post('/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const limit = getRateLimit(ip);

  if (limit.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((limit.windowStart + WINDOW_MS - Date.now()) / 1000 / 60);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${retryAfter} minuto(s).`,
    });
  }

  const { username, password } = req.body || {};
  const admin = verifyAdmin(username, password);

  if (!admin) {
    recordFailedAttempt(ip);
    const remaining = MAX_ATTEMPTS - (limit.count + 1);
    return res.status(401).json({
      error: remaining > 0
        ? `Usuario o contraseña incorrectos. ${remaining} intento(s) restante(s).`
        : 'Usuario o contraseña incorrectos. Cuenta bloqueada temporalmente.',
    });
  }

  clearAttempts(ip);
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(admin)));
  return res.json({ ok: true, admin });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.json({ ok: true });
});

module.exports = router;
