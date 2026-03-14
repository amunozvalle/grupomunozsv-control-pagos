const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { attachSession, requireAdmin } = require('./auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(attachSession);

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/registrar', require('./routes/registrar'));
app.use('/api/trabajadores', requireAdmin, require('./routes/trabajadores'));
app.use('/api/ramas', requireAdmin, require('./routes/ramas'));
app.use('/api/registros', requireAdmin, require('./routes/registros'));
app.use('/api/whatsapp', requireAdmin, require('./routes/whatsapp'));
app.use('/api/admin-users', requireAdmin, require('./routes/adminUsers'));

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message });
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
