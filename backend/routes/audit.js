const express = require('express');
const router = express.Router();
const db = require('../store');

router.get('/', (req, res) => {
  res.json(db.getAuditLog().slice(0, 200));
});

module.exports = router;
