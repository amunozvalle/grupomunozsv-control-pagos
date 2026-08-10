const express = require('express');
const db = require('../store');

const router = express.Router();

// GET /api/montos — todos los montos entregados, por período
router.get('/', (req, res) => {
  res.json(db.getMontosEntregados());
});

// PUT /api/montos/:periodKey — guarda los montos de un período
router.put('/:periodKey', (req, res) => {
  const { periodKey } = req.params;
  if (!/^(semana|dia|mes)_/.test(periodKey)) {
    return res.status(400).json({ error: 'periodKey inválido' });
  }
  const montos = db.setMontosPeriodo(periodKey, req.body?.montos);
  res.json({ periodKey, montos });
});

// POST /api/montos/migrar — importa lo guardado en el navegador (una sola vez)
router.post('/migrar', (req, res) => {
  const importados = db.mergeMontosEntregados(req.body?.map);
  res.json({ importados, montos: db.getMontosEntregados() });
});

module.exports = router;
