const express = require('express');
const router = express.Router();
const db = require('../store');

router.get('/:semana', (req, res) => {
  res.json(db.getRegistros(req.params.semana));
});

router.post('/:semana', (req, res) => {
  const { semana } = req.params;
  const { trabajador_id, dias, extra, anticipo, notas, pagado, pagado_at } = req.body;
  if (!trabajador_id) return res.status(400).json({ error: 'trabajador_id requerido' });
  const fields = {
    dias: dias || {},
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
