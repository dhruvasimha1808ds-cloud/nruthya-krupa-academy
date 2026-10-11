const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { makeUploader, publicPath, UPLOAD_ROOT } = require('../middleware/upload');

const router = express.Router();
const upload = makeUploader('performance', { allowVideo: false, maxSizeMB: 25 });

// GET /api/performance — public, all places with their photos nested
router.get('/', (req, res) => {
  const places = db.prepare('SELECT * FROM performance_places ORDER BY sort_order ASC, id ASC').all();
  const photoStmt = db.prepare('SELECT * FROM performance_photos WHERE place_id = ? ORDER BY sort_order ASC, id ASC');
  const withPhotos = places.map(p => ({ ...p, photos: photoStmt.all(p.id) }));
  res.json(withPhotos);
});

// POST /api/performance/places — admin, add a new city/venue { name, note, sort_order }
router.post('/places', requireAdmin, (req, res) => {
  const { name, note, sort_order } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Place name is required.' });
  const info = db.prepare('INSERT INTO performance_places (name, note, sort_order) VALUES (?, ?, ?)')
    .run(name, note || '', Number(sort_order) || 0);
  res.status(201).json(db.prepare('SELECT * FROM performance_places WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/performance/places/:id — admin, edit a place
router.put('/places/:id', requireAdmin, (req, res) => {
  const place = db.prepare('SELECT * FROM performance_places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Place not found.' });
  const { name, note, sort_order } = req.body || {};
  db.prepare('UPDATE performance_places SET name = ?, note = ?, sort_order = ? WHERE id = ?')
    .run(name ?? place.name, note ?? place.note, sort_order ?? place.sort_order, place.id);
  res.json(db.prepare('SELECT * FROM performance_places WHERE id = ?').get(place.id));
});

// DELETE /api/performance/places/:id — admin, cascades to its photos
router.delete('/places/:id', requireAdmin, (req, res) => {
  const place = db.prepare('SELECT * FROM performance_places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Place not found.' });

  const photos = db.prepare('SELECT * FROM performance_photos WHERE place_id = ?').all(place.id);
  photos.forEach(ph => fs.unlink(path.join(UPLOAD_ROOT, ph.file_path.replace('/uploads/', '')), () => {}));

  db.prepare('DELETE FROM performance_places WHERE id = ?').run(place.id);
  res.json({ ok: true });
});

// POST /api/performance/places/:id/photos — admin, multipart: file, caption, sort_order
router.post('/places/:id/photos', requireAdmin, upload.single('file'), (req, res) => {
  const place = db.prepare('SELECT * FROM performance_places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Place not found.' });
  if (!req.file) return res.status(400).json({ error: 'No file received.' });

  const { caption, sort_order } = req.body;
  const file_path = publicPath('performance', req.file.filename);
  const info = db.prepare(
    'INSERT INTO performance_photos (place_id, file_path, caption, sort_order) VALUES (?, ?, ?, ?)'
  ).run(place.id, file_path, caption || '', Number(sort_order) || 0);

  res.status(201).json(db.prepare('SELECT * FROM performance_photos WHERE id = ?').get(info.lastInsertRowid));
});

// DELETE /api/performance/photos/:photoId — admin
router.delete('/photos/:photoId', requireAdmin, (req, res) => {
  const photo = db.prepare('SELECT * FROM performance_photos WHERE id = ?').get(req.params.photoId);
  if (!photo) return res.status(404).json({ error: 'Photo not found.' });

  fs.unlink(path.join(UPLOAD_ROOT, photo.file_path.replace('/uploads/', '')), () => {});
  db.prepare('DELETE FROM performance_photos WHERE id = ?').run(photo.id);
  res.json({ ok: true });
});

module.exports = router;
