const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const ADMINS_PATH = path.join(DATA_DIR, 'admins.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function writeAdmins(admins) {
  ensureDataDir();
  fs.writeFileSync(ADMINS_PATH, JSON.stringify(admins, null, 2), 'utf8');
}

function seedBootstrapAdmin() {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME || process.env.APP_USERNAME || '';
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.APP_PASSWORD || '';
  if (!username || !password) return;

  const admin = {
    username: normalizeUsername(username),
    displayName: String(username).trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: 'bootstrap',
  };
  writeAdmins([admin]);
}

function readAdmins() {
  ensureDataDir();
  if (!fs.existsSync(ADMINS_PATH)) {
    seedBootstrapAdmin();
  }
  if (!fs.existsSync(ADMINS_PATH)) return [];

  try {
    const raw = fs.readFileSync(ADMINS_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[adminStore] Error leyendo admins.json:', error.message);
    return [];
  }
}

function listAdmins() {
  return readAdmins().map(({ passwordHash, ...admin }) => admin);
}

function findAdmin(username) {
  const normalized = normalizeUsername(username);
  return readAdmins().find((admin) => admin.username === normalized) || null;
}

function verifyAdmin(username, password) {
  const admin = findAdmin(username);
  if (!admin) return null;
  if (!verifyPassword(password, admin.passwordHash)) return null;
  const { passwordHash, ...safeAdmin } = admin;
  return safeAdmin;
}

function createAdmin({ username, password, createdBy }) {
  const trimmed = String(username || '').trim();
  const normalized = normalizeUsername(trimmed);
  if (!normalized) throw new Error('Usuario requerido');
  if (String(password || '').length < 8) {
    throw new Error('La contrasena debe tener al menos 8 caracteres');
  }

  const admins = readAdmins();
  if (admins.some((admin) => admin.username === normalized)) {
    throw new Error('Ese usuario admin ya existe');
  }

  const admin = {
    username: normalized,
    displayName: trimmed,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'admin',
  };
  admins.push(admin);
  writeAdmins(admins);

  const { passwordHash, ...safeAdmin } = admin;
  return safeAdmin;
}

module.exports = {
  listAdmins,
  verifyAdmin,
  createAdmin,
};
