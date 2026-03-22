const express = require('express');
const router = express.Router();
const db = require('../store');

// GET /api/registros/mes/:year/:month — todas las semanas del mes
router.get('/mes/:year/:month', (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month); // 1-12
  const result = db.getRegistrosMes(year, month);
  res.json(result);
});

// GET /api/registros/:semana
router.get('/:semana', (req, res) => {
  res.json(db.getRegistros(req.params.semana));
});

// POST /api/registros/:semana
router.post('/:semana', (req, res) => {
  const { semana } = req.params;
  const {
    trabajador_id, dias,
    extras, anticipos, reembolsos,
    extra, anticipo,
    notas, pagado, pagado_at,
  } = req.body;
  if (!trabajador_id) return res.status(400).json({ error: 'trabajador_id requerido' });
  const fields = {
    dias: dias || {},
    extras: extras || [],
    anticipos: anticipos || [],
    reembolsos: reembolsos || [],
    extra: Number(extra) || 0,
    anticipo: Number(anticipo) || 0,
    notas: notas || '',
  };
  if (pagado !== undefined) {
    fields.pagado = Boolean(pagado);
    fields.pagado_at = pagado ? (pagado_at || new Date().toISOString()) : null;
  }
  const row = db.upsertRegistro(semana, trabajador_id, fields);
  res.json(row);
});

router.delete('/:semana/:trabajador_id', (req, res) => {
  db.deleteRegistro(req.params.semana, req.params.trabajador_id);
  res.json({ ok: true });
});

module.exports = router;
