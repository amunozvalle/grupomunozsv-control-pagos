const express = require('express');
const router = express.Router();
const db = require('../store');

// GET /api/registros/trabajador/:id — historial de un trabajador
router.get('/trabajador/:id', (req, res) => {
  res.json(db.getRegistrosTrabajador(req.params.id));
});

// GET /api/registros/mes/:year/:month — todas las semanas del mes
router.get('/mes/:year/:month', (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month); // 1-12
  const result = db.getRegistrosMes(year, month);
  res.json(result);
});

// GET /api/registros/anual/:year — todos los registros del año agrupados por mes
router.get('/anual/:year', (req, res) => {
  const year = parseInt(req.params.year);
  const result = db.getRegistrosAnual(year);
  res.json(result);
});

// GET /api/registros/:semana
router.get('/:semana', (req, res) => {
  res.json(db.getRegistros(req.params.semana));
});

// GET /api/registros/:semana/estado — saber si la semana está cerrada
router.get('/:semana/estado', (req, res) => {
  res.json({ semana: req.params.semana, cerrada: db.isSemanaCerrada(req.params.semana) });
});

// POST /api/registros/:semana/cerrar — finalizar la semana
router.post('/:semana/cerrar', (req, res) => {
  db.cerrarSemana(req.params.semana);
  db.logAction(req, 'cerrar_semana', { semana: req.params.semana });
  res.json({ ok: true, cerrada: true });
});

// POST /api/registros/:semana/abrir — reabrir la semana
router.post('/:semana/abrir', (req, res) => {
  db.abrirSemana(req.params.semana);
  db.logAction(req, 'abrir_semana', { semana: req.params.semana });
  res.json({ ok: true, cerrada: false });
});

// POST /api/registros/:semana
router.post('/:semana', (req, res) => {
  const { semana } = req.params;
  if (db.isSemanaCerrada(semana)) {
    return res.status(423).json({ error: 'La semana está cerrada. Reábrela para poder editar.' });
  }
  const {
    trabajador_id, dias,
    extras, anticipos, reembolsos,
    extra, anticipo, reembolso,
    notas, pagado, pagado_at, notasDias,
  } = req.body;
  if (!trabajador_id) return res.status(400).json({ error: 'trabajador_id requerido' });
  const fields = {
    dias: dias || {},
    extra: Number(extra) || 0,
    anticipo: Number(anticipo) || 0,
    reembolso: Number(reembolso) || 0,
    notas: notas || '',
  };
  // Solo incluir arrays si vienen en el body para no sobrescribir con vacíos
  if (extras !== undefined) fields.extras = extras;
  if (anticipos !== undefined) fields.anticipos = anticipos;
  if (reembolsos !== undefined) fields.reembolsos = reembolsos;
  if (pagado !== undefined) {
    fields.pagado = Boolean(pagado);
    fields.pagado_at = pagado ? (pagado_at || new Date().toISOString()) : null;
  }
  if (notasDias !== undefined) fields.notasDias = notasDias;
  const row = db.upsertRegistro(semana, trabajador_id, fields);
  db.logAction(req, 'upsert_registro', { trabajador_id, semana });
  res.json(row);
});

router.delete('/:semana/:trabajador_id', (req, res) => {
  if (db.isSemanaCerrada(req.params.semana)) {
    return res.status(423).json({ error: 'La semana está cerrada. Reábrela para poder editar.' });
  }
  db.deleteRegistro(req.params.semana, req.params.trabajador_id);
  res.json({ ok: true });
});

module.exports = router;
