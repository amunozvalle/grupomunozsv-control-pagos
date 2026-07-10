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
    browser: Browsers.macOS('Safari'),
    logger,
    printQRInTerminal: true,
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
    getMessage: async () => undefined,
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
      status = 'connecting';
      qrDataUrl = null;
      console.log('[whatsapp] Autenticado — esperando sincronización de sesión...');

      // Trigger session key distribution via presence
      setTimeout(async () => {
        try { await sock.sendPresenceUpdate('available'); } catch (_) {}
      }, 2000);

      // Wait for messaging-history.set which signals session is ready
      const onHistorySet = () => {
        console.log('[whatsapp] Historial recibido — esperando 5s más...');
        if (status === 'connecting') {
          setTimeout(() => {
            if (status === 'connecting') {
              status = 'ready';
              console.log('[whatsapp] ✓ Listo para enviar');
            }
          }, 5000);
        }
      };
      sock.ev.on('messaging-history.set', onHistorySet);

      // Fallback: 60 seconds
      setTimeout(() => {
        if (status === 'connecting') {
          sock.ev.off('messaging-history.set', onHistorySet);
          status = 'ready';
          console.log('[whatsapp] ✓ Listo (timeout 60s)');
        }
      }, 60000);
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

function resetWhatsApp() {
  _stopReconnect = true;
  sock = null;
  status = 'disconnected';
  qrDataUrl = null;
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
}

async function waitForReady(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sock && status === 'ready') return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function sendMessage(groupId, message, retries = 8) {
  if (!sock || status !== 'ready') throw new Error('WhatsApp no está conectado');
  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;

  // Fetch group members and assert signal sessions
  let memberJids = [];
  try {
    const currentSock = sock;
    const meta = await currentSock.groupMetadata(jid);
    console.log(`[whatsapp] Grupo: ${meta.subject}, participantes: ${meta.participants.length}`);
    memberJids = meta.participants.map(p => p.id);
    if (memberJids.length && typeof currentSock.assertSessions === 'function') {
      console.log(`[whatsapp] Pre-calentando sesiones para ${memberJids.length} participantes...`);
      await currentSock.assertSessions(memberJids, true);
      console.log(`[whatsapp] Sesiones afirmadas — esperando 4s`);
      await new Promise(r => setTimeout(r, 4000));
    }
  } catch (e) {
    console.log(`[whatsapp] pre-warm warning: ${e.message}`);
  }

  const delays = [3000, 6000, 10000, 15000, 20000, 25000, 30000];
  for (let i = 0; i < retries; i++) {
    // Always use fresh sock reference (may change after reconnect)
    const currentSock = sock;
    if (!currentSock || status !== 'ready') {
      console.log(`[whatsapp] Socket no disponible en intento ${i + 1} — esperando reconexión...`);
      const recovered = await waitForReady(90000);
      if (!recovered) throw new Error('WhatsApp no reconectó a tiempo');
      continue;
    }
    try {
      await currentSock.sendMessage(jid, { text: message });
      console.log(`[whatsapp] ✓ Mensaje enviado a ${jid}`);
      return;
    } catch (err) {
      console.log(`[whatsapp] Error intento ${i + 1}/${retries}: ${err.message}`);
      if (i < retries - 1) {
        // On "No sessions", force re-establish sessions with fresh sock
        if (err.message?.includes('No sessions') && memberJids.length) {
          const freshSock = sock;
          if (freshSock && typeof freshSock.assertSessions === 'function') {
            try {
              console.log(`[whatsapp] Forzando re-establecimiento de sesiones...`);
              await freshSock.assertSessions(memberJids, true);
              await new Promise(r => setTimeout(r, 5000));
            } catch (e2) {
              console.log(`[whatsapp] assertSessions force error: ${e2.message}`);
            }
          }
        }
        const wait = delays[i] || 30000;
        try { if (sock) await sock.sendPresenceUpdate('available'); } catch (_) {}
        await new Promise(r => setTimeout(r, wait));
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

module.exports = { initWhatsApp, disconnectWhatsApp, resetWhatsApp, getStatus, getChats, sendMessage, enviarRecordatorios, loadGrupos, saveGrupos };
