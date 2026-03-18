/**
 * Backup automático de pagos.json a GitHub
 * Requiere env: GITHUB_BACKUP_TOKEN (Personal Access Token con permiso contents:write)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'pagos.json');
const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
const GITHUB_REPO = 'amunozvalle/grupomunozsv-control-pagos';

async function backupToGithub() {
  if (!GITHUB_TOKEN) {
    console.log('[backup-github] Sin token — omitido');
    return { ok: false, error: 'Sin GITHUB_BACKUP_TOKEN' };
  }
  if (!fs.existsSync(DB_PATH)) {
    return { ok: false, error: 'pagos.json no encontrado' };
  }

  const content = fs.readFileSync(DB_PATH, 'utf8');
  const base64 = Buffer.from(content).toString('base64');
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
  const filePath = `backups/pagos-${date}.json`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'grupomunoz-nomina',
  };

  // Si ya existe el archivo de hoy, obtener su SHA para actualizarlo
  let sha;
  try {
    const check = await fetch(apiUrl, { headers });
    if (check.ok) {
      const data = await check.json();
      sha = data.sha;
    }
  } catch {}

  const body = { message: `backup: ${date}`, content: base64, branch: 'main' };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const err = await res.text();
    console.error('[backup-github] Error:', err);
    return { ok: false, error: err };
  }

  console.log(`[backup-github] ✓ Guardado: ${filePath}`);
  return { ok: true, file: filePath, date };
}

module.exports = { backupToGithub };
