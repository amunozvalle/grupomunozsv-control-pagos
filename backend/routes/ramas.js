const express = require('express');
const router = express.Router();
const db = require('../store');
const { nanoid } = require('nanoid');

router.get('/', (req, res) => {
  res.json(db.getRamas());
});

router.post('/', (req, res) => {
  const { label, emoji, color } = req.body;
  if (!label) return res.status(400).json({ error: 'label requerido' });
  const rama = { id: nanoid(10), label: label.trim(), emoji: emoji || '🔧', color: color || '#888888' };
  db.addRama(rama);
  res.json(rama);
});

router.delete('/:id', (req, res) => {
  db.deleteRama(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
