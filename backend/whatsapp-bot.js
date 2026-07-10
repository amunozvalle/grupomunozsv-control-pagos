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
let _sendLock = false;

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
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 2000,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
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

      setTimeout(async () => {
        try { await sock.sendPresenceUpdate('available'); } catch (_) {}
      }, 2000);

      const onHistorySet = () => {
        console.log('[whatsapp] Historial recibido - esperando 5s');
        if (status === 'connecting') {
          setTimeout(() => {
            if (status === 'connecting') {
              status = 'ready';
              console.log('[whatsapp] Listo para enviar');
            }
          }, 5000);
        }
      };
      sock.ev.on('messaging-history.set', onHistorySet);

      setTimeout(() => {
        if (status === 'connecting') {
          sock.ev.off('messaging-history.set', onHistorySet);
          status = 'ready';
          console.log('[whatsapp] Listo (timeout 60s)');
        }
      }, 60000);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'desconocido';
      console.log(`[whatsapp] Desconectado. Codigo: ${code} | Razon: ${reason}`);

      const loggedOut = code === DisconnectReason.loggedOut;
      const shouldReconnect = !_stopReconnect && !loggedOut;

      status = 'disconnected';
      qrDataUrl = null;
      sock = null;

      if (loggedOut) {
        console.log('[whatsapp] Sesion cerrada - limpiando');
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } else if (shouldReconnect) {
        console.log('[whatsapp] Reintentando en 5s');
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
  _sendLock = false;
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

function buildRecordatorioMsg({ semanaLabel }) {
  let msg = `Recordatorio de Nomina - ${semanaLabel}\n`;
  msg += `Buenos dias a todos. Por favor recuerden llenar su hoja de trabajo del sabado antes de terminar el dia.\n\n`;
  msg += `Gracias`;
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
