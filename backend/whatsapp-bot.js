const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const GRUPOS_PATH = path.join(DATA_DIR, 'whatsapp-grupos.json');
const AUTH_DIR = path.join(DATA_DIR, '.baileys_auth');

let sock = null;
let qrDataUrl = null;
let status = 'disconnected';
let _stopReconnect = false;

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

async function initWhatsApp() {
  if (sock && status === 'ready') return;
  _stopReconnect = false;
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[whatsapp] Baileys v${version.join('.')} isLatest:${isLatest}`);

  const logger = pino({ level: 'warn' });

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu('Desktop'),
    logger,
    printQRInTerminal: true,
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status = 'qr';
      qrDataUrl = await qrcode.toDataURL(qr);
      console.log('[whatsapp] ✓ QR generado');
    }

    if (connection === 'open') {
      status = 'ready';
      qrDataUrl = null;
      console.log('[whatsapp] ✓ Conectado a WhatsApp');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'desconocido';
      console.log(`[whatsapp] Desconectado. Código: ${code} | Razón: ${reason}`);

      const loggedOut = code === DisconnectReason.loggedOut;
      const shouldReconnect = !_stopReconnect && !loggedOut;

      status = 'disconnected';
      qrDataUrl = null;
      sock = null;

      if (loggedOut) {
        console.log('[whatsapp] Sesión cerrada — limpiando credenciales');
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } else if (shouldReconnect) {
        console.log('[whatsapp] Reintentando en 5s...');
        setTimeout(initWhatsApp, 5000);
      }
    }
  });
}

function disconnectWhatsApp() {
  _stopReconnect = true;
  if (sock) { sock.logout().catch(() => {}); sock = null; }
  status = 'disconnected';
  qrDataUrl = null;
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}

async function sendMessage(groupId, message, retries = 3) {
  if (!sock || status !== 'ready') throw new Error('WhatsApp no está conectado');
  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
  for (let i = 0; i < retries; i++) {
    try {
      await sock.sendMessage(jid, { text: message });
      return;
    } catch (err) {
      const isNoSession = err?.message?.toLowerCase().includes('no sessions') ||
                          err?.message?.toLowerCase().includes('nosessions');
      if (isNoSession && i < retries - 1) {
        console.log(`[whatsapp] "No sessions" en intento ${i + 1}, reintentando en 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw err;
      }
    }
  }
}

async function getChats() {
  if (!sock || status !== 'ready') return [];
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.entries(groups).map(([id, g]) => ({ id, name: g.subject }));
  } catch { return []; }
}

function buildRecordatorioMsg({ semanaLabel }) {
  let msg = `📋 *Recordatorio de Nómina — ${semanaLabel}*\n`;
  msg += `Buenos días a todos. Por favor recuerden llenar su hoja de trabajo del sábado antes de terminar el día.\n\n`;
  msg += `Gracias 🙏`;
  return msg;
}

async function enviarRecordatorios({ trabajadores, registros, ramas, semanaLabel }) {
  if (status !== 'ready') return { ok: false, error: 'WhatsApp no conectado' };
  const grupos = loadGrupos(), resultados = [];
  for (const rama of ramas) {
    const groupId = grupos[rama.id];
    if (!groupId) { resultados.push({ rama: rama.label, ok: false, error: 'Sin grupo' }); continue; }
    try { await sendMessage(groupId, buildRecordatorioMsg({ semanaLabel })); resultados.push({ rama: rama.label, ok: true }); }
    catch (err) { resultados.push({ rama: rama.label, ok: false, error: err.message }); }
  }
  return { ok: true, resultados };
}

module.exports = { initWhatsApp, disconnectWhatsApp, getStatus, getChats, sendMessage, enviarRecordatorios, loadGrupos, saveGrupos };
