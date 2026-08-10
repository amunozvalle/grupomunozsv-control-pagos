const express = require('express');
const db = require('../store');

const router = express.Router();

// GET /api/montos — todos los montos entregados, por período
router.get('/', (req, res) => {
  res.json(db.getMontosEntregados());
});

// GET /api/montos/historial — copias anteriores (para revertir a mano)
router.get('/historial', (req, res) => {
  res.json(db.getMontosHistorial());
});

// PUT /api/montos/:periodKey — guarda los montos de un período.
// PROTECCIÓN: si el período ya tiene datos y llega una lista vacía,
// NO se borra a menos que venga { permitirVacio: true } explícito.
// Esto evita que un guardado accidental del navegador borre lo bueno.
router.put('/:periodKey', (req, res) => {
  const { periodKey } = req.params;
  if (!/^(semana|dia|mes)_/.test(periodKey)) {
    return res.status(400).json({ error: 'periodKey inválido' });
  }
  const nuevos = Array.isArray(req.body?.montos) ? req.body.montos : [];
  const tieneAlgo = nuevos.some(m => Number(m?.monto) > 0 || String(m?.label || '').trim() !== '');
  const existentes = db.getMontosPeriodo(periodKey);
  const yaTenia = existentes.some(m => Number(m?.monto) > 0);

  if (!tieneAlgo && yaTenia && !req.body?.permitirVacio) {
    // Rechazo protector: no borramos datos buenos con un vacío
    return res.status(409).json({
      error: 'proteccion_vacio',
      mensaje: 'Este período ya tenía montos y llegó una lista vacía. No se borró. Enviá permitirVacio:true para forzar.',
      montos: existentes,
    });
  }

  const montos = db.setMontosPeriodo(periodKey, nuevos);
  res.json({ periodKey, montos });
});

// POST /api/montos/migrar — importa lo guardado en el navegador (sin pisar lo del servidor)
router.post('/migrar', (req, res) => {
  const importados = db.mergeMontosEntregados(req.body?.map);
  res.json({ importados, montos: db.getMontosEntregados() });
});

module.exports = router;
