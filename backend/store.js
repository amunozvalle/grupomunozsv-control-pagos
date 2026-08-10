/**
 * Simple synchronous JSON file store.
 * Replaces better-sqlite3 without any native compilation.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'pagos.json');
const SEEDED_DB_PATH = path.join(__dirname, 'pagos.json');

const DEFAULT_RAMAS = [
  { id: 'carpintero', label: 'Carpintero', emoji: '🪚', color: '#c97b3a' },
  { id: 'albanil',    label: 'Albañil',    emoji: '🧱', color: '#7b9bc9' },
  { id: 'tablaroca',  label: 'Tabla Roca', emoji: '📦', color: '#9b7bc9' },
  { id: 'vidrieria',  label: 'Vidriería',  emoji: '🪟', color: '#5cb8b2' },
];

function load() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    if (DB_PATH !== SEEDED_DB_PATH && fs.existsSync(SEEDED_DB_PATH)) {
      fs.copyFileSync(SEEDED_DB_PATH, DB_PATH);
    } else {
      return { ramas: DEFAULT_RAMAS, trabajadores: [], registros: {} };
    }
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    if (!raw.trim()) throw new Error('empty file');
    const data = JSON.parse(raw);
    // ensure required keys exist
    if (!data.ramas) data.ramas = DEFAULT_RAMAS;
    if (!data.trabajadores) data.trabajadores = [];
    if (!data.registros) data.registros = {};
    data.trabajadores = data.trabajadores.map((t) => ({
      ...t,
      telefono: t.telefono || '',
      activo: t.activo !== undefined ? t.activo : true,
    }));
    return data;
  } catch (e) {
    console.error('[store] Error leyendo pagos.json, usando backup o defaults:', e.message);
    // Try backup
    const backup = DB_PATH + '.bak';
    if (fs.existsSync(backup)) {
      try {
        return JSON.parse(fs.readFileSync(backup, 'utf8'));
      } catch {}
    }
    return { ramas: DEFAULT_RAMAS, trabajadores: [], registros: {} };
  }
}

function save(data) {
  // Atomic write: write to temp file then rename to avoid corruption on crash
  const tmp = DB_PATH + '.tmp';
  const backup = DB_PATH + '.bak';
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, json, 'utf8');
  // Keep a backup of the last good save
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backup);
  }
  fs.renameSync(tmp, DB_PATH);
}

let _db = load();

const db = {
  // ── Ramas ──────────────────────────────────────────────────────────────────
  getRamas() { return [..._db.ramas]; },
  addRama(rama) { _db.ramas.push(rama); save(_db); },
  deleteRama(id) { _db.ramas = _db.ramas.filter(r => r.id !== id); save(_db); },

  // ── Trabajadores ──────────────────────────────────────────────────────────
  getTrabajadores() { return [..._db.trabajadores].sort((a, b) => a.nombre.localeCompare(b.nombre)); },
  getTrabajador(id) { return _db.trabajadores.find(t => t.id === id) || null; },
  addTrabajador(t) { _db.trabajadores.push({ ...t, telefono: t.telefono || '', activo: t.activo !== undefined ? t.activo : true }); save(_db); },
  updateTrabajador(id, fields) {
    const idx = _db.trabajadores.findIndex(t => t.id === id);
    if (idx !== -1) { _db.trabajadores[idx] = { ..._db.trabajadores[idx], ...fields }; save(_db); }
  },
  deleteTrabajador(id) {
    _db.trabajadores = _db.trabajadores.filter(t => t.id !== id);
    // cascade: delete registros for this worker
    for (const semana of Object.keys(_db.registros)) {
      delete _db.registros[semana][id];
    }
    save(_db);
  },

  // ── Cobros ────────────────────────────────────────────────────────────────
  getCobros() { return [...(_db.cobros || [])].sort((a, b) => b.fecha.localeCompare(a.fecha)); },
  addCobro(cobro) {
    if (!_db.cobros) _db.cobros = [];
    _db.cobros.push(cobro);
    save(_db);
  },
  deleteCobro(id) {
    if (!_db.cobros) return;
    _db.cobros = _db.cobros.filter(c => c.id !== id);
    save(_db);
  },

  // ── Montos entregados (por período: semana_/dia_/mes_) ───────────────────
  getMontosEntregados() { return { ...(_db.montosEntregados || {}) }; },
  getMontosPeriodo(periodKey) {
    const all = _db.montosEntregados || {};
    return Array.isArray(all[periodKey]) ? all[periodKey] : [];
  },
  setMontosPeriodo(periodKey, montos) {
    if (!_db.montosEntregados) _db.montosEntregados = {};
    const limpio = (Array.isArray(montos) ? montos : []).map(m => ({
      id: m.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
      label: String(m.label || ''),
      monto: m.monto === '' || m.monto === null || m.monto === undefined ? '' : Number(m.monto) || 0,
    }));
    const tieneAlgo = limpio.some(m => String(m.label).trim() !== '' || Number(m.monto) > 0);
    if (tieneAlgo) _db.montosEntregados[periodKey] = limpio;
    else delete _db.montosEntregados[periodKey];
    save(_db);
    return _db.montosEntregados[periodKey] || [];
  },
  // Migración: sube lo que estaba en localStorage sin pisar lo que ya está en el servidor
  mergeMontosEntregados(map) {
    if (!_db.montosEntregados) _db.montosEntregados = {};
    let importados = 0;
    for (const [k, v] of Object.entries(map || {})) {
      if (!Array.isArray(v)) continue;
      const tieneAlgo = v.some(m => Number(m?.monto) > 0);
      if (!tieneAlgo) continue;
      const yaExiste = Array.isArray(_db.montosEntregados[k]) &&
        _db.montosEntregados[k].some(m => Number(m?.monto) > 0);
      if (yaExiste) continue;
      _db.montosEntregados[k] = v.map(m => ({
        id: m.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
        label: String(m.label || ''),
        monto: Number(m.monto) || 0,
      }));
      importados++;
    }
    if (importados) save(_db);
    return importados;
  },

  // ── Semanas cerradas (finalizadas) ───────────────────────────────────────
  isSemanaCerrada(semana) {
    return Array.isArray(_db.semanasCerradas) && _db.semanasCerradas.includes(semana);
  },
  getSemanasCerradas() {
    return Array.isArray(_db.semanasCerradas) ? [..._db.semanasCerradas] : [];
  },
  cerrarSemana(semana) {
    if (!Array.isArray(_db.semanasCerradas)) _db.semanasCerradas = [];
    if (!_db.semanasCerradas.includes(semana)) _db.semanasCerradas.push(semana);
    save(_db);
    return true;
  },
  abrirSemana(semana) {
    if (Array.isArray(_db.semanasCerradas)) {
      _db.semanasCerradas = _db.semanasCerradas.filter(s => s !== semana);
      save(_db);
    }
    return true;
  },

  // ── Registros ─────────────────────────────────────────────────────────────
  getRegistros(semana) {
    const week = _db.registros[semana] || {};
    return Object.entries(week).map(([trabajador_id, data]) => ({ semana, trabajador_id, ...data }));
  },
  getRegistro(semana, trabajador_id) {
    return (_db.registros[semana] || {})[trabajador_id] || null;
  },
  upsertRegistro(semana, trabajador_id, fields) {
    if (!_db.registros[semana]) _db.registros[semana] = {};
    _db.registros[semana][trabajador_id] = {
      ...(_db.registros[semana][trabajador_id] || {}),
      ...fields,
    };
    save(_db);
    return { semana, trabajador_id, ..._db.registros[semana][trabajador_id] };
  },
  deleteRegistro(semana, trabajador_id) {
    if (_db.registros[semana]) {
      delete _db.registros[semana][trabajador_id];
      save(_db);
    }
  },

  // Devuelve todos los registros de semanas que caen en year/month
  getRegistrosMes(year, month) {
    const result = [];
    for (const [semana, workers] of Object.entries(_db.registros || {})) {
      // semana = "YYYY-MM-DD" (lunes de la semana)
      const d = new Date(semana + 'T12:00:00');
      // incluir semanas que overlap con el mes
      const semStart = d;
      const semEnd = new Date(d); semEnd.setDate(d.getDate() + 5);
      const mesStart = new Date(year, month - 1, 1);
      const mesEnd = new Date(year, month, 0);
      if (semEnd < mesStart || semStart > mesEnd) continue;
      for (const [trabajador_id, data] of Object.entries(workers)) {
        result.push({ semana, trabajador_id, ...data });
      }
    }
    return result;
  },

  // Devuelve todos los registros del año agrupados por mes
  getRegistrosAnual(year) {
    const result = {};
    for (let month = 1; month <= 12; month++) {
      result[month] = [];
    }
    for (const [semana, workers] of Object.entries(_db.registros || {})) {
      const d = new Date(semana + 'T12:00:00');
      const semStart = d;
      const semEnd = new Date(d); semEnd.setDate(d.getDate() + 5);
      for (let month = 1; month <= 12; month++) {
        const mesStart = new Date(year, month - 1, 1);
        const mesEnd = new Date(year, month, 0);
        if (semEnd < mesStart || semStart > mesEnd) continue;
        for (const [trabajador_id, data] of Object.entries(workers)) {
          result[month].push({ semana, trabajador_id, ...data });
        }
      }
    }
    return result;
  },

  // Audit log
  getAuditLog() { return [...(_db.audit || [])].reverse(); },
  addAuditLog(entry) {
    if (!_db.audit) _db.audit = [];
    _db.audit.push(entry);
    if (_db.audit.length > 500) _db.audit = _db.audit.slice(-500);
    save(_db);
  },

  // Historial por trabajador
  getRegistrosTrabajador(trabajador_id) {
    const result = [];
    for (const [semana, workers] of Object.entries(_db.registros || {})) {
      if (workers[trabajador_id]) {
        result.push({ semana, trabajador_id, ...workers[trabajador_id] });
      }
    }
    return result.sort((a, b) => b.semana.localeCompare(a.semana));
  },
};

db.logAction = function(req, action, details) {
  db.addAuditLog({
    id: Date.now() + '-' + Math.random().toString(36).slice(2,6),
    timestamp: new Date().toISOString(),
    admin: req.admin?.username || 'unknown',
    action,
    details,
  });
};
module.exports = db;
