const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/contact — public, submits the "Visit Us" form
router.post('/', (req, res) => {
  const { name, phone, message } = req.body || {};
  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required.' });
  }
  db.prepare('INSERT INTO contact_messages (name, phone, message) VALUES (?, ?, ?)')
    .run(name, phone || '', message);
  res.status(201).json({ ok: true });
});

// GET /api/contact — admin only, view submitted enquiries
router.get('/', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM contact_messages ORDER BY id DESC').all();
  res.json(rows);
});

// DELETE /api/contact/:id — admin only
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
