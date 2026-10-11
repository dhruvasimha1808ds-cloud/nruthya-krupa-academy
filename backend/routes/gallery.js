const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { makeUploader, publicPath, UPLOAD_ROOT } = require('../middleware/upload');

const router = express.Router();
const upload = makeUploader('gallery', { allowVideo: true, maxSizeMB: 200 });

const CATEGORIES = ['photo', 'video', 'gejje_pooje', 'media'];

// GET /api/gallery?category=photo — public. Omit category for everything.
router.get('/', (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) {
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category.' });
    rows = db.prepare('SELECT * FROM gallery_items WHERE category = ? ORDER BY sort_order ASC, id DESC').all(category);
  } else {
    rows = db.prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id DESC').all();
  }
  res.json(rows);
});

// POST /api/gallery — admin only, multipart form: file, category, title, caption, sort_order
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  const { category, title, caption, sort_order } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category.' });

  const ext = path.extname(req.file.filename).toLowerCase();
  const media_type = ['.mp4', '.mov', '.webm'].includes(ext) ? 'video' : 'image';
  const file_path = publicPath('gallery', req.file.filename);

  const info = db.prepare(
    `INSERT INTO gallery_items (category, title, caption, file_path, media_type, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(category, title || '', caption || '', file_path, media_type, Number(sort_order) || 0);

  res.status(201).json(db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/gallery/:id — admin only, JSON body: title, caption, sort_order, category
router.put('/:id', requireAdmin, (req, res) => {
  const item = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Gallery item not found.' });

  const { title, caption, sort_order, category } = req.body || {};
  db.prepare(
    `UPDATE gallery_items SET title = ?, caption = ?, sort_order = ?, category = ? WHERE id = ?`
  ).run(
    title ?? item.title,
    caption ?? item.caption,
    sort_order ?? item.sort_order,
    (category && CATEGORIES.includes(category)) ? category : item.category,
    item.id
  );
  res.json(db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(item.id));
});

// DELETE /api/gallery/:id — admin only, also removes the file from disk
router.delete('/:id', requireAdmin, (req, res) => {
  const item = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Gallery item not found.' });

  const diskPath = path.join(UPLOAD_ROOT, item.file_path.replace('/uploads/', ''));
  fs.unlink(diskPath, () => {}); // best effort, ignore errors

  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

module.exports = router;
