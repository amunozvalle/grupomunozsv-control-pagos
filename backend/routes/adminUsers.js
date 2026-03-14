const express = require('express');
const { listAdmins, createAdmin } = require('../adminStore');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(listAdmins());
});

router.post('/', (req, res) => {
  try {
    const admin = createAdmin({
      username: req.body?.username,
      password: req.body?.password,
      createdBy: req.admin?.displayName || req.admin?.username || 'admin',
    });
    return res.json(admin);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
