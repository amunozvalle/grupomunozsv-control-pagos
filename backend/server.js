const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { attachSession, requireAdmin } = require('./auth');
const { backupToGithub } = require('./backup-github');
const { initWhatsApp, enviarRecordatorios, getStatus: waStatus } = require('./whatsapp-bot');

const app = express();
app.set('trust proxy', true);

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

// Backup manual desde el dashboard
app.post('/api/backup-github', requireAdmin, async (req, res) => {
  const result = await backupToGithub();
  res.json(result);
});

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
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  // Backup diario a GitHub a las 11 PM (hora El Salvador)
  const msHasta11pm = () => {
    const now = new Date();
    const target = new Date(now.toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' }) + 'T23:00:00-06:00');
    if (target <= now) target.setDate(target.getDate() + 1);
    return target - now;
  };
  setTimeout(function scheduleDaily() {
    backupToGithub();
    setTimeout(scheduleDaily, 24 * 60 * 60 * 1000);
  }, msHasta11pm());

  // Recordatorio WhatsApp cada sábado a las 7 AM (El Salvador)
  const msHastaSabado7am = () => {
    const now = new Date();
    const svNow = new Date(now.toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' }));
    const day = svNow.getDay(); // 0=dom, 6=sab
    const daysToSat = (6 - day + 7) % 7 || 7; // días hasta próximo sábado
    const target = new Date(svNow);
    target.setDate(target.getDate() + daysToSat);
    target.setHours(7, 0, 0, 0);
    // Convertir a UTC para el timeout
    const targetUTC = new Date(target.toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
    targetUTC.setHours(targetUTC.getHours() + 6); // SV = UTC-6
    return Math.max(targetUTC - now, 0);
  };

  setTimeout(function scheduleSabado() {
    const { getRegistros, getTrabajadores, getRamas } = require('./store');
    const st = waStatus();
    if (st.status === 'ready') {
      const now = new Date();
      const svDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
      // Semana key = lunes anterior
      const svDay = new Date(svDate + 'T12:00:00');
      const mon = new Date(svDay);
      mon.setDate(svDay.getDate() - 5); // sábado - 5 = lunes
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
    setTimeout(scheduleSabado, 7 * 24 * 60 * 60 * 1000); // repetir cada semana
  }, msHastaSabado7am());
});
