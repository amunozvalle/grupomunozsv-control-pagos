const express = require('express');
const router = express.Router();
const db = require('../store');
const { nanoid } = require('nanoid');

router.get('/', (req, res) => {
  res.json(db.getTrabajadores());
});

router.post('/', (req, res) => {
  const { nombre, rama, sueldo, telefono } = req.body;
  if (!nombre || !rama) return res.status(400).json({ error: 'nombre y rama requeridos' });
  const t = {
    id: nanoid(10),
    nombre: nombre.trim(),
    rama,
    sueldo: Number(sueldo) || 0,
    telefono: typeof telefono === 'string' ? telefono.trim() : '',
  };
  db.addTrabajador(t);
  res.json(t);
});

router.put('/:id', (req, res) => {
  const { nombre, rama, sueldo, telefono } = req.body;
  const fields = {};
  if (nombre !== undefined) fields.nombre = nombre.trim();
  if (rama !== undefined) fields.rama = rama;
  if (sueldo !== undefined) fields.sueldo = Number(sueldo) || 0;
  if (telefono !== undefined) fields.telefono = typeof telefono === 'string' ? telefono.trim() : '';
  db.updateTrabajador(req.params.id, fields);
  res.json(db.getTrabajador(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.deleteTrabajador(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
