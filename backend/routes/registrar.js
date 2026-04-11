const express = require('express');
const db = require('../store');
const {
  createRegistrarToken,
  createPermanentRegistrarToken,
  verifyRegistrarToken,
} = require('../registrarTokens');

const router = express.Router();

const EMPTY_DIAS = { L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 };

function withBaseUrl(req, token) {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${req.get('host')}/registrar/${token}`;
}

function getSemanaActualKey() {
  // Use El Salvador timezone (UTC-6) to match the admin dashboard
  const svDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
  const today = new Date(svDate + 'T12:00:00');
  const dow = today.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveSemana(payload, bodySemana) {
  return payload.semana || bodySemana || getSemanaActualKey();
}

function buildRow(req, semana, trabajador) {
  const weeklyToken = createRegistrarToken(semana, trabajador.id);
  const permanentToken = createPermanentRegistrarToken(trabajador.id);

  return {
    trabajador,
    semana,
    token: weeklyToken,
    url: withBaseUrl(req, weeklyToken),
    permanentToken,
    permanentUrl: withBaseUrl(req, permanentToken),
  };
}

router.get('/links/:semana', (req, res) => {
  const trabajadores = db.getTrabajadores();
  const rows = trabajadores.map((trabajador) => buildRow(req, req.params.semana, trabajador));
  res.json(rows);
});

router.get('/:token', (req, res) => {
  try {
    const payload = verifyRegistrarToken(req.params.token);
    const semana = resolveSemana(payload);
    const trabajador = db.getTrabajador(payload.trabajadorId);

    if (!trabajador) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const record = db.getRegistro(semana, trabajador.id);

    return res.json({
      semana,
      trabajador,
      record: record || {
        dias: EMPTY_DIAS,
        extra: 0,
        anticipo: 0,
        notas: '',
      },
      tokenType: payload.type || 'weekly',
      permanentToken: createPermanentRegistrarToken(trabajador.id),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/:token', (req, res) => {
  try {
    const payload = verifyRegistrarToken(req.params.token);
    // For permanent tokens, prefer the semana the frontend saw (from GET response)
    // so GET and POST always use the exact same week key
    const semana = payload.semana || req.body.semana || getSemanaActualKey();
    const trabajador = db.getTrabajador(payload.trabajadorId);

    if (!trabajador) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const { dias, extras, anticipos, extra, anticipo, notas } = req.body;
    const fields = {
      dias: { ...EMPTY_DIAS, ...(dias || {}) },
      extra: Number(extra) || 0,
      anticipo: Number(anticipo) || 0,
      notas: (notas || '').trim(),
    };
    if (extras !== undefined) fields.extras = extras;
    if (anticipos !== undefined) fields.anticipos = anticipos;
    const row = db.upsertRegistro(semana, trabajador.id, fields);

    return res.json({
      ok: true,
      semana,
      trabajador,
      record: row,
      tokenType: payload.type || 'weekly',
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
