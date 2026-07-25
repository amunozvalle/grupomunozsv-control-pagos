const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { useDurableAuthState } = require('./wa-auth');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const GRUPOS_PATH = path.join(DATA_DIR, 'whatsapp-grupos.json');
const AUTH_FILE = path.join(DATA_DIR, 'whatsapp-auth.json');

let sock = null;
let auth = null;
let qrDataUrl = null;
let status = 'disconnected';
let _stopReconnect = false;
let _sendLock = false;
let _initializing = false;
let _readyTimer = null;

// Evita que una promesa suelta de Baileys tumbe TODO el backend (nomina).
process.on('unhandledRejection', (err) => {
  console.log('[whatsapp] unhandledRejection ignorado:', (err && err.message) || err);
});

function loadGrupos() {
  if (!fs.existsSync(GRUPOS_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(GRUPOS_PATH, 'utf8')); } catch { return {}; }
}

function saveGrupos(data) {
  fs.writeFileSync(GRUPOS_PATH, JSON.stringify(data, null, 2));
}

function getStatus() {
  return { status, hasQr: !!qrDataUrl, qr: status === 'qr' ? qrDataUrl : null };
}

// Cierra y limpia el socket actual para no dejar conexiones duplicadas (evita conflict 440)
function teardownSock() {
  if (_readyTimer) { clearTimeout(_readyTimer); _readyTimer = null; }
  if (sock) {
    try { sock.ev.removeAllListeners(); } catch (_) {}
    try { sock.end(undefined); } catch (_) {}
    try { sock.ws && sock.ws.close(); } catch (_) {}
  }
  sock = null;
}

async function initWhatsApp() {
  if (status === 'ready') return;
  if (_initializing) { console.log('[whatsapp] init ya en progreso - ignorando'); return; }
  _initializing = true;
  _stopReconnect = false;

  try {
    teardownSock();

    auth = await useDurableAuthState(AUTH_FILE);
    const { state, saveCreds } = auth;
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[whatsapp] Baileys v${version.join('.')} isLatest:${isLatest}`);

    const logger = pino({ level: 'warn' });

    const currentSock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: Browsers.macOS('Safari'),
      logger,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 2000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      getMessage: async () => undefined,
    });
    sock = currentSock;

    currentSock.ev.on('creds.update', saveCreds);

    currentSock.ev.on('connection.update', async (update) => {
      // Ignorar eventos de un socket viejo ya reemplazado
      if (sock !== currentSock) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        status = 'qr';
        qrDataUrl = await qrcode.toDataURL(qr);
        console.log('[whatsapp] QR generado');
      }

      if (connection === 'open') {
        status = 'connecting';
        qrDataUrl = null;
        console.log('[whatsapp] Autenticado - esperando sincronizacion');

        setTimeout(() => {
          if (sock !== currentSock) return;
          currentSock.sendPresenceUpdate('available').catch(() => {});
        }, 2000);

        // El bot solo envia a grupos; no necesita sincronizar historial.
        // Tras unos segundos estable, lo marcamos listo.
        if (_readyTimer) clearTimeout(_readyTimer);
        _readyTimer = setTimeout(() => {
          if (sock === currentSock && status === 'connecting') {
            status = 'ready';
            console.log('[whatsapp] Listo para enviar');
          }
        }, 8000);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'desconocido';
        console.log(`[whatsapp] Desconectado. Codigo: ${code} | Razon: ${reason}`);

        if (sock === currentSock) sock = null;
        status = 'disconnected';
        qrDataUrl = null;
        if (_readyTimer) { clearTimeout(_readyTimer); _readyTimer = null; }

        const loggedOut = code === DisconnectReason.loggedOut;
        const replaced = code === DisconnectReason.connectionReplaced;

        if (loggedOut) {
          console.log('[whatsapp] Sesion cerrada - limpiando');
          if (auth) auth.clear();
        } else if (replaced) {
          // Otra conexion tomo la sesion. NO reconectar para no pelear (evita bucle 440).
          console.log('[whatsapp] Conexion reemplazada - no se reconecta automaticamente');
        } else if (!_stopReconnect) {
          console.log('[whatsapp] Reintentando en 5s');
          setTimeout(() => { initWhatsApp().catch(() => {}); }, 5000);
        }
      }
    });
  } catch (e) {
    console.log('[whatsapp] error en init:', e.message);
    teardownSock();
    status = 'disconnected';
  } finally {
    _initializing = false;
  }
}

function disconnectWhatsApp() {
  _stopReconnect = true;
  _initializing = false;
  const s = sock;
  sock = null;
  if (_readyTimer) { clearTimeout(_readyTimer); _readyTimer = null; }
  if (s) {
    try { s.logout().catch(() => {}); } catch (_) {}
    try { s.ev.removeAllListeners(); } catch (_) {}
    try { s.end(undefined); } catch (_) {}
  }
  status = 'disconnected';
  qrDataUrl = null;
  if (auth) auth.clear();
}

function resetWhatsApp() {
  _stopReconnect = true;
  _initializing = false;
  teardownSock();
  status = 'disconnected';
  qrDataUrl = null;
  _sendLock = false;
  try { if (auth) auth.clear(); } catch {}
}

// Exporta la sesion actual como base64 para guardarla en la env var WA_SESSION
function exportSession() {
  if (!auth) return null;
  try { return auth.exportBase64(); } catch { return null; }
}

async function waitForReady(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sock && status === 'ready') return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function sendMessage(groupId, message, retries = 5) {
  if (!sock || status !== 'ready') throw new Error('WhatsApp no esta conectado');

  // Prevent concurrent sends
  if (_sendLock) {
    console.log('[whatsapp] Otro envio en progreso - esperando...');
    let waited = 0;
    while (_sendLock && waited < 120000) {
      await new Promise(r => setTimeout(r, 1000));
      waited += 1000;
    }
    if (_sendLock) throw new Error('Otro envio en progreso, intenta de nuevo');
  }

  _sendLock = true;
  try {
    const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;

    let memberJids = [];
    try {
      const meta = await sock.groupMetadata(jid);
      console.log(`[whatsapp] Grupo: ${meta.subject}, participantes: ${meta.participants.length}`);
      memberJids = meta.participants.map(p => p.id);
      if (memberJids.length && typeof sock.assertSessions === 'function') {
        console.log('[whatsapp] Pre-calentando sesiones...');
        await sock.assertSessions(memberJids, false);
        console.log('[whatsapp] Sesiones afirmadas - esperando 3s');
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {
      console.log(`[whatsapp] pre-warm warning: ${e.message}`);
    }

    const delays = [5000, 10000, 15000, 20000];
    for (let i = 0; i < retries; i++) {
      const currentSock = sock;
      if (!currentSock || status !== 'ready') {
        console.log(`[whatsapp] Socket no disponible en intento ${i + 1} - esperando...`);
        const recovered = await waitForReady(90000);
        if (!recovered) throw new Error('WhatsApp no reconecto a tiempo');
        continue;
      }
      try {
        await currentSock.sendMessage(jid, { text: message });
        console.log(`[whatsapp] Mensaje enviado a ${jid}`);
        return;
      } catch (err) {
        console.log(`[whatsapp] Error intento ${i + 1}/${retries}: ${err.message}`);
        if (i < retries - 1) {
          const wait = delays[i] || 20000;
          try { if (sock) await sock.sendPresenceUpdate('available'); } catch (_) {}
          await new Promise(r => setTimeout(r, wait));
        } else {
          throw err;
        }
      }
    }
  } finally {
    _sendLock = false;
  }
}

async function getChats() {
  if (!sock || status !== 'ready') return [];
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.entries(groups).map(([id, g]) => ({ id, name: g.subject }));
  } catch { return []; }
}

// Frases del aviso de bot — rota una al azar cada envio (mensaje "dinamico")
const AVISOS_BOT = [
  '🤖 Este es un mensaje automático del sistema de nómina. Por favor no responder a este chat.',
  '🤖 Mensaje enviado automáticamente por el sistema de nómina de Grupo Muñoz.',
  '🤖 Recordatorio automático del sistema de nómina. No es necesario responder aquí.',
  '🤖 Aviso generado automáticamente por el sistema de nómina. Gracias por su atención.',
  '🤖 Este recordatorio fue enviado de forma automática. Por favor no responder a este mensaje.',
];

function buildRecordatorioMsg({ semanaLabel }) {
  const aviso = AVISOS_BOT[Math.floor(Math.random() * AVISOS_BOT.length)];
  let msg = `📋 *Recordatorio de Nómina — ${semanaLabel}*\n\n`;
  msg += `Buenos días a todos. Por favor, recuerden llenar su hoja de trabajo del sábado antes de las diez de la mañana.\n\n`;
  msg += `¡Gracias! 🙏\n\n`;
  msg += `_${aviso}_`;
  return msg;
}

// Segundo recordatorio (10 AM) — para quienes aun no han llenado su hoja
function buildSegundoRecordatorioMsg({ semanaLabel }) {
  const aviso = AVISOS_BOT[Math.floor(Math.random() * AVISOS_BOT.length)];
  let msg = `⏰ *Recordatorio de Nómina — ${semanaLabel}*\n\n`;
  msg += `Este es un recordatorio. Los que aún no han llenado su hoja de trabajo, por favor llénenla.\n\n`;
  msg += `¡Gracias! 🙏\n\n`;
  msg += `_${aviso}_`;
  return msg;
}

async function enviarRecordatorios({ trabajadores, registros, ramas, semanaLabel, builder = buildRecordatorioMsg }) {
  if (status !== 'ready') return { ok: false, error: 'WhatsApp no conectado' };
  const grupos = loadGrupos(), resultados = [];
  for (const rama of ramas) {
    const groupId = grupos[rama.id];
    if (!groupId) { resultados.push({ rama: rama.label, ok: false, error: 'Sin grupo' }); continue; }
    try { await sendMessage(groupId, builder({ semanaLabel })); resultados.push({ rama: rama.label, ok: true }); }
    catch (err) { resultados.push({ rama: rama.label, ok: false, error: err.message }); }
  }
  return { ok: true, resultados };
}

// ── Etiqueta de la semana en curso (hora de El Salvador), lunes → hoy ──
function getSemanaLabelSV() {
  const svDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
  const svDay = new Date(svDate + 'T12:00:00');
  const mon = new Date(svDay);
  mon.setDate(svDay.getDate() - ((svDay.getDay() + 6) % 7));
  const fmt = (d) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  return `${fmt(mon)} - ${fmt(svDay)}`;
}

// ── Hora actual en El Salvador (dia, hora, minuto, fecha) ──
function svNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return {
    weekday: get('weekday'),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

// ── Programador: recordatorios automaticos cada SABADO (hora de El Salvador) ──
//    8:00 AM  → recordatorio principal
//    10:00 AM → recordatorio para quienes aun no han llenado
const _lastFired = {}; // { '2026-07-25:8': true, '2026-07-25:10': true }
let _schedulerStarted = false;

async function dispararRecordatorio(builder, etiqueta) {
  if (status !== 'ready') {
    console.log(`[scheduler] Es hora (${etiqueta}) pero el bot no esta conectado — no se envio`);
    return;
  }
  console.log(`[scheduler] Enviando recordatorio automatico (${etiqueta})...`);
  const db = require('./store');
  const trabajadores = db.getTrabajadores();
  const ramas = db.getRamas();
  const semanaLabel = getSemanaLabelSV();
  const res = await enviarRecordatorios({ trabajadores, registros: {}, ramas, semanaLabel, builder });
  const ok = (res.resultados || []).filter((r) => r.ok).length;
  console.log(`[scheduler] Recordatorio (${etiqueta}) enviado a ${ok} grupo(s)`);
}

function startScheduler() {
  if (_schedulerStarted) return;
  _schedulerStarted = true;
  console.log('[scheduler] Activo — recordatorios sabados 8:00 AM y 10:00 AM (El Salvador)');
  setInterval(async () => {
    try {
      const { weekday, hour, minute, date } = svNow();
      if (weekday !== 'Sat' || minute >= 5) return; // solo sabados, ventana :00–:04

      if (hour === 8 && !_lastFired[`${date}:8`]) {
        _lastFired[`${date}:8`] = true;
        await dispararRecordatorio(buildRecordatorioMsg, '8 AM');
      }
      if (hour === 10 && !_lastFired[`${date}:10`]) {
        _lastFired[`${date}:10`] = true;
        await dispararRecordatorio(buildSegundoRecordatorioMsg, '10 AM');
      }
    } catch (e) {
      console.log('[scheduler] error:', e.message);
    }
  }, 60 * 1000);
}

// ── Auto-conectar al arrancar si ya hay sesion guardada (WA_SESSION o archivo) ──
function hasSession() {
  return !!process.env.WA_SESSION || fs.existsSync(AUTH_FILE);
}
function autoStart() {
  startScheduler();
  if (hasSession()) {
    console.log('[whatsapp] Sesion detectada — conectando automaticamente al arrancar');
    setTimeout(() => { initWhatsApp().catch(() => {}); }, 3000);
  } else {
    console.log('[whatsapp] Sin sesion guardada — esperando conexion manual (escanear QR)');
  }
}

// Arranca al cargar el modulo (cuando el servidor levanta)
autoStart();

module.exports = { initWhatsApp, disconnectWhatsApp, resetWhatsApp, exportSession, getStatus, getChats, sendMessage, enviarRecordatorios, loadGrupos, saveGrupos };
