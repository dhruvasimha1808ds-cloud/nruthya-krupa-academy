const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { makeUploader, publicPath } = require('../middleware/upload');

const router = express.Router();
const uploadSettingImage = makeUploader('settings', { allowVideo: false, maxSizeMB: 15 });

// GET /api/settings — public, returns everything as a flat object
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

// PUT /api/settings — admin only, body is { key: value, key2: value2, ... }
// Only known keys already present in the table are updated (prevents junk keys).
router.put('/', requireAdmin, (req, res) => {
  const updates = req.body || {};
  const existingKeys = new Set(db.prepare('SELECT key FROM site_settings').all().map(r => r.key));
  const stmt = db.prepare('UPDATE site_settings SET value = ? WHERE key = ?');

  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (existingKeys.has(key)) stmt.run(String(value ?? ''), key);
    }
  });
  tx(Object.entries(updates));

  res.json({ ok: true });
});

// POST /api/settings/image/:key — admin only, uploads an image and stores its
// path under the given settings key (e.g. site_background, guru_portrait, hero_image, scholarship_image)
router.post('/image/:key', requireAdmin, uploadSettingImage.single('image'), (req, res) => {
  const { key } = req.params;
  const existing = db.prepare('SELECT key FROM site_settings WHERE key = ?').get(key);
  if (!existing) {
    return res.status(400).json({ error: `Unknown setting key: ${key}` });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file received.' });
  }
  const url = publicPath('settings', req.file.filename);
  db.prepare('UPDATE site_settings SET value = ? WHERE key = ?').run(url, key);
  res.json({ ok: true, url });
});

module.exports = router;
