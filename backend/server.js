const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/trabajadores', require('./routes/trabajadores'));
app.use('/api/ramas', require('./routes/ramas'));
app.use('/api/registros', require('./routes/registros'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/registrar', require('./routes/registrar'));

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global error handler — devuelve JSON en vez de crashear
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
