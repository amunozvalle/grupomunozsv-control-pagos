const express = require('express');
const { verifyAdmin } = require('../adminStore');
const { createSessionToken, sessionCookie, clearSessionCookie } = require('../auth');

const router = express.Router();

router.get('/session', (req, res) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return res.json({ admin: req.admin });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = verifyAdmin(username, password);
  if (!admin) {
    return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
  }

  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(admin)));
  return res.json({ ok: true, admin });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.json({ ok: true });
});

module.exports = router;
