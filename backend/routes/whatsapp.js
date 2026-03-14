const express = require('express');
const router = express.Router();
const db = require('../store');

// ── helpers ─────────────────────────────────────────────────────────────────

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/** Levenshtein distance */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/** Returns { worker, confidence 0-1 } or null */
function matchWorker(raw, trabajadores) {
  const q = normalize(raw);
  if (!q) return null;

  let best = null, bestScore = 0;

  for (const t of trabajadores) {
    const name = normalize(t.nombre);

    // Exact
    if (name === q) return { worker: t, confidence: 1.0 };

    // Contains
    if (name.includes(q) || q.includes(name)) {
      const score = 0.85 + 0.15 * (Math.min(q.length, name.length) / Math.max(q.length, name.length));
      if (score > bestScore) { bestScore = score; best = t; }
      continue;
    }

    // Token overlap
    const qTokens = q.split(/\s+/);
    const nTokens = name.split(/\s+/);
    const overlap = qTokens.filter(tk => nTokens.some(nt => nt === tk || nt.startsWith(tk) || tk.startsWith(nt))).length;
    if (overlap > 0) {
      const score = 0.6 + 0.25 * (overlap / Math.max(qTokens.length, nTokens.length));
      if (score > bestScore) { bestScore = score; best = t; }
      continue;
    }

    // Levenshtein fallback (only for short names)
    if (q.length <= 20 && name.length <= 20) {
      const dist = levenshtein(q, name);
      const maxLen = Math.max(q.length, name.length);
      const score = 1 - dist / maxLen;
      if (score >= 0.5 && score > bestScore) { bestScore = score; best = t; }
    }
  }

  return best ? { worker: best, confidence: Math.round(bestScore * 100) / 100 } : null;
}

const DIAS_KEYS = ['L', 'M', 'X', 'J', 'V', 'S'];

const DAY_ALIASES = {
  L: ['l', 'lu', 'lun', 'lunes', 'monday', 'mon'],
  M: ['m', 'ma', 'mar', 'martes', 'tuesday', 'tue'],
  X: ['x', 'mi', 'mie', 'mier', 'miercoles', 'wednesday', 'wed'],
  J: ['j', 'ju', 'jue', 'jueves', 'thursday', 'thu'],
  V: ['v', 'vi', 'vie', 'viernes', 'friday', 'fri'],
  S: ['s', 'sa', 'sab', 'sabado', 'saturday', 'sat'],
};

// Like normalize but preserves periods and slashes (needed for decimal values like 0.5)
function normalizeSoft(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDayValue(s) {
  const n = normalizeSoft(s).replace(/[^a-z0-9.,/\s]/g, '');
  if (['1', '1.0', 'completo', 'dia', 'si', 'yes', 'full', 'trabajo', 'ok'].includes(n)) return 1;
  if (['0.5', '.5', '1/2', 'medio', 'medio dia', 'half', 'md'].includes(n)) return 0.5;
  if (['0', 'no', 'ausente', 'falto', 'descanso', 'off', '-'].includes(n)) return 0;
  const num = parseFloat(n.replace(',', '.'));
  if (!isNaN(num) && num >= 0 && num <= 1) return num;
  return null;
}

/** Extract per-day values from a line. Returns {} if nothing found. */
function extractDays(line) {
  const result = {};
  // Use soft-normalized line to preserve decimals (0.5) while stripping accents
  const soft = normalizeSoft(line);

  for (const [key, aliases] of Object.entries(DAY_ALIASES)) {
    for (const alias of aliases) {
      const pattern = new RegExp(
        `(?:^|\\s|[|,;])${alias}\\s*[:=\\-]?\\s*([0-9.,/]+|completo|medio|si|no|ausente|falto|descanso|ok|half|md)(?=\\s|[|,;]|$)`,
        'i'
      );
      const m = pattern.exec(soft);
      if (m) {
        const val = parseDayValue(m[1]);
        if (val !== null) { result[key] = val; break; }
      }
    }
  }
  return result;
}

/** Fill N days starting Monday when individual days are not specified */
function fillDaysFromTotal(total) {
  const dias = {};
  let rem = total;
  for (const d of DIAS_KEYS) {
    if (rem <= 0) break;
    if (rem >= 1) { dias[d] = 1; rem -= 1; }
    else if (rem === 0.5) { dias[d] = 0.5; rem = 0; }
  }
  return dias;
}

/** Detect "worked Mon, Tue, Wed" natural language patterns */
function extractNaturalDays(line) {
  const result = {};
  const norm = normalizeSoft(line);

  // e.g. "trabajo lunes martes y miercoles"
  for (const [key, aliases] of Object.entries(DAY_ALIASES)) {
    for (const alias of aliases) {
      if (new RegExp(`\\b${alias}\\b`).test(norm)) {
        result[key] = 1;
        break;
      }
    }
  }

  // If found natural days, also check for negations: "no fue el viernes"
  if (Object.keys(result).length > 0) {
    const negPattern = /(?:no\s+(?:fue|trabajo|vino|asistio)|falto|ausente|descanso)\s+(?:el\s+)?(\w+)/gi;
    let m;
    while ((m = negPattern.exec(norm)) !== null) {
      for (const [key, aliases] of Object.entries(DAY_ALIASES)) {
        if (aliases.includes(normalize(m[1]))) result[key] = 0;
      }
    }
  }

  return result;
}

// ── parse endpoint ───────────────────────────────────────────────────────────

router.post('/parse', (req, res) => {
  const { text, semana } = req.body;
  if (!text) return res.status(400).json({ error: 'text requerido' });

  const trabajadores = db.getTrabajadores();
  const existingRecords = semana
    ? db.getRegistros(semana).reduce((acc, r) => { acc[r.trabajador_id] = r; return acc; }, {})
    : {};

  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract name: first segment before | or first word(s) before colon
    let rawName = '';
    if (line.includes('|')) {
      rawName = line.split('|')[0].trim();
    } else if (/[:,-]/.test(line)) {
      rawName = line.split(/[:,-]/)[0].trim();
    } else {
      rawName = line.split(/\s+/).slice(0, 2).join(' ');
    }

    const match = matchWorker(rawName, trabajadores);

    // Parse days
    let dias = extractDays(line);
    let source = 'individual';

    if (Object.keys(dias).length === 0) {
      // Try total days
      const mTotal = line.match(/(?:d[ií]as?|dias?\s*trabajados?)\s*[:=\-]?\s*(\d+(?:[.,]5)?)/i);
      if (mTotal) {
        dias = fillDaysFromTotal(Number(mTotal[1].replace(',', '.')));
        source = 'total';
      } else {
        // Try natural language
        const natural = extractNaturalDays(line);
        if (Object.keys(natural).length > 0) {
          dias = natural;
          source = 'natural';
        }
      }
    }

    // Extra pay
    let extra = null;
    const mExtra = line.match(/extra\s*[:=\-]?\s*\$?\s*(\d+(?:[.,]\d+)?)/i);
    if (mExtra) extra = Number(mExtra[1].replace(',', '.'));

    // Advance
    let anticipo = null;
    const mAnt = line.match(/(?:anticipo|adelanto)\s*[:=\-]?\s*\$?\s*(\d+(?:[.,]\d+)?)/i);
    if (mAnt) anticipo = Number(mAnt[1].replace(',', '.'));

    // Notes
    let notas = '';
    const mNotas = line.match(/notas?\s*[:=\-]?\s*(.+)$/i);
    if (mNotas) notas = mNotas[1].trim();

    const totalDias = Object.values(dias).reduce((s, v) => s + v, 0);
    const hasExisting = match && existingRecords[match.worker.id];

    results.push({
      lineIndex: i,
      rawLine: line,
      rawName,
      worker: match ? match.worker : null,
      confidence: match ? match.confidence : 0,
      dias,
      diasSource: source,
      totalDias,
      extra,
      anticipo,
      notas,
      hasExisting,
      existingData: hasExisting ? existingRecords[match.worker.id] : null,
      error: !match
        ? `No se encontró trabajador para "${rawName}"`
        : Object.keys(dias).length === 0
        ? `No se encontraron días válidos para "${match.worker.nombre}"`
        : null,
    });
  }

  res.json(results);
});

// ── apply endpoint ───────────────────────────────────────────────────────────

router.post('/apply', (req, res) => {
  const { semana, rows } = req.body;
  if (!semana || !rows) return res.status(400).json({ error: 'semana y rows requeridos' });

  const validRows = rows.filter(r => r.worker && !r.error && Object.keys(r.dias).length > 0);

  for (const row of validRows) {
    const existing = db.getRegistro(semana, row.worker.id);
    const existingDias = existing?.dias || {};
    db.upsertRegistro(semana, row.worker.id, {
      dias: { ...existingDias, ...row.dias },
      extra: row.extra !== null ? row.extra : (existing?.extra || 0),
      anticipo: row.anticipo !== null ? row.anticipo : (existing?.anticipo || 0),
      notas: row.notas || (existing?.notas || ''),
    });
  }

  res.json({ applied: validRows.length });
});

module.exports = router;
