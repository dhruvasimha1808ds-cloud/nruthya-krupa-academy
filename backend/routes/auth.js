const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { requireAdmin, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login  { username, password } -> { token }
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username: user.username });
});

// POST /api/auth/change-password  { currentPassword, newPassword }  (requires login)
router.post('/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Current password and a new password (8+ characters) are required.' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.sub);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  res.json({ ok: true });
});

// GET /api/auth/me  — check whether the current token is still valid
router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

module.exports = router;
