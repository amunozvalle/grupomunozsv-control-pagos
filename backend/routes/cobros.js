const express = require('express');
const router = express.Router();
const db = require('../store');

// GET /api/cobros — lista todos
router.get('/', (req, res) => {
  res.json(db.getCobros());
});

// POST /api/cobros — agrega uno o varios (texto rápido o JSON)
router.post('/', (req, res) => {
  const { texto, fecha, notas } = req.body;
  const hoy = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
  const added = [];

  if (texto) {
    // Parsear "IVAN 420, BEYLI 500" o líneas separadas
    const partes = texto.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    for (const parte of partes) {
      const match = parte.match(/^(.+?)\s+([\d.,]+)\s*$/);
      if (!match) continue;
      const nombre = match[1].trim().toUpperCase();
      const monto = parseFloat(match[2].replace(',', '.'));
      if (!nombre || isNaN(monto) || monto <= 0) continue;
      const cobro = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre,
        monto,
        fecha: hoy,
        notas: notas || '',
        creadoEn: new Date().toISOString(),
      };
      db.addCobro(cobro);
      added.push(cobro);
    }
  } else {
    // JSON directo: { nombre, monto, fecha?, notas? }
    const { nombre, monto } = req.body;
    if (!nombre || !monto) return res.status(400).json({ error: 'nombre y monto requeridos' });
    const cobro = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: nombre.trim().toUpperCase(),
      monto: parseFloat(monto),
      fecha: hoy,
      notas: notas || '',
      creadoEn: new Date().toISOString(),
    };
    db.addCobro(cobro);
    added.push(cobro);
  }

  res.json({ ok: true, added });
});

// DELETE /api/cobros/:id
router.delete('/:id', (req, res) => {
  db.deleteCobro(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
