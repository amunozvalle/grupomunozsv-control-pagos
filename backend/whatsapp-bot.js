const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Boom } = require('@hapi/boom');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const GRUPOS_PATH = path.join(DATA_DIR, 'whatsapp-grupos.json');
const AUTH_DIR = path.join(DATA_DIR, '.baileys_auth');

let sock = null;
let qrDataUrl = null;
let status = 'disconnected'; // disconnected | qr | ready
let _stopReconnect = false;

// ── Grupos ────────────────────────────────────────────────────────────────────

function loadGrupos() {
  if (!fs.existsSync(GRUPOS_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(GRUPOS_PATH, 'utf8')); } catch { return {}; }
}

function saveGrupos(data) {
  fs.writeFileSync(GRUPOS_PATH, JSON.stringify(data, null, 2));
}

// ── Estado público ────────────────────────────────────────────────────────────

function getStatus() {
  return { status, hasQr: !!qrDataUrl, qr: status === 'qr' ? qrDataUrl : null };
}

// ── Inicializar ───────────────────────────────────────────────────────────────

async function initWhatsApp() {
  if (sock && status === 'ready') return; // ya conectado

  _stopReconnect = false;
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.macOS('Desktop'),
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      status = 'qr';
      qrDataUrl = await qrcode.toDataURL(qr);
      console.log('[whatsapp] QR generado — escanea desde el panel de administración');
    }

    if (connection === 'open') {
      status = 'ready';
      qrDataUrl = null;
      console.log('[whatsapp] ✓ Conectado');
    }

    if (connection === 'close') {
      const shouldReconnect =
        !_stopReconnect &&
        (lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true);

      status = 'disconnected';
      qrDataUrl = null;
      sock = null;
      console.log('[whatsapp] Desconectado. Reconectar:', shouldReconnect);

      if (shouldReconnect) {
        setTimeout(initWhatsApp, 5000);
      } else {
        // Logged out — limpiar credenciales para mostrar QR nuevo la próxima vez
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    }
  });
}

function disconnectWhatsApp() {
  _stopReconnect = true;
  if (sock) {
    sock.logout().catch(() => {});
    sock = null;
  }
  status = 'disconnected';
  qrDataUrl = null;
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}

// ── Enviar mensaje ────────────────────────────────────────────────────────────

async function sendMessage(groupId, message) {
  if (!sock || status !== 'ready') throw new Error('WhatsApp no está conectado');
  // Baileys requiere JID completo. Si no trae @, agregarlo
  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  await sock.sendMessage(jid, { text: message });
}

// ── Listar grupos ─────────────────────────────────────────────────────────────

async function getChats() {
  if (!sock || status !== 'ready') return [];
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.entries(groups).map(([id, g]) => ({ id, name: g.subject }));
  } catch { return []; }
}

// ── Construir mensaje recordatorio ────────────────────────────────────────────

function buildRecordatorioMsg({ rama, trabajadores, registros, semanaLabel }) {
  const recordMap = Object.fromEntries(registros.map((r) => [r.trabajador_id, r]));
  const DIAS_KEYS = ['L', 'M', 'X', 'J', 'V', 'S'];

  const sinDias = [];
  const conAnticipo = [];

  for (const t of trabajadores) {
    if (t.rama !== rama) continue;
    const rec = recordMap[t.id];
    const dias = rec ? DIAS_KEYS.reduce((s, d) => s + (rec.dias?.[d] || 0), 0) : 0;
    if (dias === 0) sinDias.push(t.nombre);
    const anticipo = Array.isArray(rec?.anticipos)
      ? rec.anticipos.reduce((s, a) => s + a.monto, 0)
      : (rec?.anticipo || 0);
    if (anticipo > 0) conAnticipo.push(`${t.nombre} ($${anticipo.toFixed(2)})`);
  }

  let msg = `📋 *Recordatorio de Nómina — ${semanaLabel}*\n`;
  msg += `Por favor llenar la hoja de trabajo para el *sábado*.\n\n`;

  if (sinDias.length > 0) {
    msg += `⚠️ *Sin días registrados esta semana:*\n`;
    sinDias.forEach((n) => (msg += `  • ${n}\n`));
    msg += '\n';
  } else {
    msg += `✅ Todos tienen días registrados esta semana.\n\n`;
  }

  if (conAnticipo.length > 0) {
    msg += `💵 *Con adelanto pendiente:*\n`;
    conAnticipo.forEach((n) => (msg += `  • ${n}\n`));
    msg += '\n';
  }

  msg += `_Sistema de Nómina — Grupo Muñoz_`;
  return msg;
}

// ── Enviar recordatorios a todas las ramas ────────────────────────────────────

async function enviarRecordatorios({ trabajadores, registros, ramas, semanaLabel }) {
  if (status !== 'ready') {
    console.log('[whatsapp] No conectado — recordatorios omitidos');
    return { ok: false, error: 'WhatsApp no conectado' };
  }

  const grupos = loadGrupos();
  const resultados = [];

  for (const rama of ramas) {
    const groupId = grupos[rama.id];
    if (!groupId) {
      resultados.push({ rama: rama.label, ok: false, error: 'Sin grupo configurado' });
      continue;
    }

    const msg = buildRecordatorioMsg({ rama: rama.id, trabajadores, registros, semanaLabel });
    try {
      await sendMessage(groupId, msg);
      resultados.push({ rama: rama.label, ok: true });
      console.log(`[whatsapp] ✓ Recordatorio enviado a ${rama.label}`);
    } catch (err) {
      resultados.push({ rama: rama.label, ok: false, error: err.message });
    }
  }

  return { ok: true, resultados };
}

module.exports = {
  initWhatsApp,
  disconnectWhatsApp,
  getStatus,
  getChats,
  sendMessage,
  enviarRecordatorios,
  loadGrupos,
  saveGrupos,
};
