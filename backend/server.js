const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { attachSession, requireAdmin, requireViewer } = require('./auth');
const { backupToGithub } = require('./backup-github');
const { initWhatsApp, enviarRecordatorios, getStatus: waStatus } = require('./whatsapp-bot');

// ── Validaciones de entorno críticas ──────────────────────────────────────
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('[FATAL] SESSION_SECRET no está definida. El servidor no puede arrancar en producción sin ella.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', true);

// ── CORS restringido al origen configurado ────────────────────────────────
const allowedOrigin = process.env.FRONTEND_URL || null;
app.use(cors(allowedOrigin ? {
  origin: allowedOrigin,
  credentials: true,
} : {})); // en desarrollo sin FRONTEND_URL se permite todo

app.use(express.json());
app.use(attachSession);

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/registrar', require('./routes/registrar'));
app.use('/api/trabajadores', requireAdmin, require('./routes/trabajadores'));
app.use('/api/ramas', requireAdmin, require('./routes/ramas'));
app.use('/api/registros', requireViewer, require('./routes/registros'));
app.use('/api/whatsapp', requireAdmin, require('./routes/whatsapp'));
app.use('/api/cobros', requireViewer, require('./routes/cobros'));
app.use('/api/montos', requireViewer, require('./routes/montos'));
app.use('/api/admin-users', requireAdmin, require('./routes/adminUsers'));
app.get('/api/audit', requireAdmin, require('./routes/audit'));

// Backup manual desde el dashboard
app.post('/api/backup-github', requireAdmin, async (req, res) => {
  const result = await backupToGithub();
  res.json(result);
});

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);

  // Auto-reconectar WhatsApp si hay credenciales guardadas
  // DATA_DIR debe coincidir con el usado en whatsapp-bot.js
  const DATA_DIR = process.env.DATA_DIR || __dirname;
  const AUTH_DIR = path.join(DATA_DIR, '.baileys_auth');
  if (fs.existsSync(AUTH_DIR)) {
    console.log('[whatsapp] Credenciales encontradas — reconectando automáticamente...');
    initWhatsApp().catch(err => console.error('[whatsapp] Error al reconectar:', err.message));
  }

  // ── Backup diario a las 11 PM (El Salvador) ────────────────────────────
  const msHasta11pm = () => {
    const now = new Date();
    // Calculamos la próxima 11 PM en zona El Salvador usando Date directamente
    const svNowStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' });
    const [datePart, timePart] = svNowStr.split(' ');
    const [h] = timePart.split(':').map(Number);
    const target = new Date(`${datePart}T23:00:00-06:00`);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target - now;
  };

  setTimeout(function scheduleDaily() {
    backupToGithub();
    setTimeout(scheduleDaily, 24 * 60 * 60 * 1000);
  }, msHasta11pm());

  // ── Recordatorio WhatsApp cada sábado a las 7 AM (El Salvador) ─────────
  // CORRECCIÓN: usamos Intl para calcular el target en UTC sin doble offset
  const msHastaSabado7am = () => {
    const now = new Date();

    // Fecha/hora actual en El Salvador
    const svStr = now.toLocaleString('en-CA', {
      timeZone: 'America/El_Salvador',
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    // svStr ejemplo: "2026-05-23, 10:30:00"
    const svNow = new Date(svStr.replace(', ', 'T') + '-06:00');

    const day = svNow.getDay(); // 0=dom, 6=sab
    const daysToSat = (6 - day + 7) % 7 || 7;

    // Próximo sábado a las 7 AM en El Salvador = UTC-6 → 13:00 UTC
    const target = new Date(svNow);
    target.setDate(svNow.getDate() + daysToSat);
    target.setHours(7, 0, 0, 0); // 7 AM en la fecha SV
    // Convertir explícitamente: 7 AM SV (UTC-6) = 13:00 UTC
    const targetUTC = new Date(target.getTime() + 6 * 60 * 60 * 1000);

    return Math.max(targetUTC - now, 0);
  };

  setTimeout(function scheduleSabado() {
    const { getRegistros, getTrabajadores, getRamas } = require('./store');
    const st = waStatus();
    if (st.status === 'ready') {
      const now = new Date();
      const svDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
      const svDay = new Date(svDate + 'T12:00:00');
      const mon = new Date(svDay);
      mon.setDate(svDay.getDate() - 5);
      const semanaKey = mon.toISOString().slice(0, 10);
      const semanaLabel = `${mon.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - ${svDay.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;
      enviarRecordatorios({
        trabajadores: getTrabajadores(),
        registros: getRegistros(semanaKey),
        ramas: getRamas(),
        semanaLabel,
      }).then(r => console.log('[whatsapp] Recordatorio sábado:', r));
    } else {
      console.log('[whatsapp] Sábado — no conectado, recordatorio omitido');
    }
    setTimeout(scheduleSabado, 7 * 24 * 60 * 60 * 1000);
  }, msHastaSabado7am());
});


