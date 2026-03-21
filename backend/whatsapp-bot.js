const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const GRUPOS_PATH = path.join(DATA_DIR, 'whatsapp-grupos.json');

let client = null;
let qrDataUrl = null;
let status = 'disconnected'; // disconnected | qr | connecting | ready
let readyCallbacks = [];

// Carga configuración de grupos por rama
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

function initWhatsApp() {
  if (client) return;

  const authPath = path.join(DATA_DIR, '.wwebjs_auth');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    },
  });

  client.on('qr', async (qr) => {
    status = 'qr';
    qrDataUrl = await qrcode.toDataURL(qr);
    console.log('[whatsapp] QR generado — escanea desde el panel');
  });

  client.on('authenticated', () => {
    status = 'connecting';
    qrDataUrl = null;
    console.log('[whatsapp] Autenticado');
  });

  client.on('ready', () => {
    status = 'ready';
    qrDataUrl = null;
    console.log('[whatsapp] ✓ Listo');
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks = [];
  });

  client.on('disconnected', (reason) => {
    status = 'disconnected';
    qrDataUrl = null;
    client = null;
    console.log('[whatsapp] Desconectado:', reason);
  });

  client.initialize().catch((err) => {
    console.error('[whatsapp] Error al inicializar:', err.message);
    status = 'disconnected';
    client = null;
  });
}

async function sendMessage(groupId, message) {
  if (!client || status !== 'ready') throw new Error('WhatsApp no está conectado');
  await client.sendMessage(groupId, message);
}

async function getChats() {
  if (!client || status !== 'ready') return [];
  const chats = await client.getChats();
  return chats
    .filter((c) => c.isGroup)
    .map((c) => ({ id: c.id._serialized, name: c.name }));
}

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
    if (rec?.anticipo > 0) conAnticipo.push(`${t.nombre} ($${rec.anticipo.toFixed(2)})`);
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

module.exports = { initWhatsApp, getStatus, getChats, sendMessage, enviarRecordatorios, loadGrupos, saveGrupos };
