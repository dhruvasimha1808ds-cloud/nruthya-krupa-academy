/*  backend/routes/performance.js
 *  ──────────────────────────────
 *  GET    /api/performance              – public, places with nested photos
 *  POST   /api/performance              – admin, add a place (text only)
 *  PUT    /api/performance/:id          – admin, update place details
 *  DELETE /api/performance/:id          – admin, delete place + its photos
 *  POST   /api/performance/:id/photos   – admin, upload photo → Cloudinary
 *  DELETE /api/performance/photos/:photoId – admin, delete single photo
 */

const express = require('express');
const router = express.Router();

const db = require('../db/database');
const { requireAdmin: auth } = require('../middleware/auth');
const {
  makeUploader,
  uploadToCloudinary,
  deleteAsset,
  cleanupLocalFile,
  CLOUDINARY_CONFIGURED,
  IMAGE_TYPES,
} = require('../middleware/upload');

// ── GET /api/performance ───────────────────────────────────────
router.get('/', (_req, res) => {
  try {
    const places = db
      .prepare(
        'SELECT id, place_name, state, note FROM performance_places ORDER BY id ASC'
      )
      .all();

    const photoStmt = db.prepare(
      'SELECT id, file_path, caption FROM performance_photos WHERE place_id = ? ORDER BY id ASC'
    );

    const result = places.map((p) => ({
      ...p,
      photos: photoStmt.all(p.id),
    }));

    res.json(result);
  } catch (err) {
    console.error('[performance] GET error:', err);
    res.status(500).json({ error: 'Failed to load performances.' });
  }
});

// ── POST /api/performance  (text only) ────────────────────────
router.post('/', auth, (req, res) => {
  try {
    const { place_name, state = '', note = '' } = req.body || {};
    if (!place_name || !place_name.trim()) {
      return res.status(400).json({ error: 'place_name is required.' });
    }

    const info = db
      .prepare(
        'INSERT INTO performance_places (place_name, state, note) VALUES (?, ?, ?)'
      )
      .run(place_name.trim(), state.trim(), note.trim());

    res.status(201).json({
      success: true,
      place: { id: info.lastInsertRowid, place_name, state, note, photos: [] },
    });
  } catch (err) {
    console.error('[performance] POST error:', err);
    res.status(500).json({ error: 'Failed to add place.' });
  }
});

// ── PUT /api/performance/:id ──────────────────────────────────
router.put('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { place_name, state, note } = req.body || {};

    const existing = db
      .prepare('SELECT id FROM performance_places WHERE id = ?')
      .get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Place not found.' });
    }

    const sets = [];
    const vals = [];
    if (place_name !== undefined) {
      sets.push('place_name = ?');
      vals.push(place_name);
    }
    if (state !== undefined) {
      sets.push('state = ?');
      vals.push(state);
    }
    if (note !== undefined) {
      sets.push('note = ?');
      vals.push(note);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    vals.push(id);
    db.prepare(`UPDATE performance_places SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    res.json({ success: true });
  } catch (err) {
    console.error('[performance] PUT error:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

// ── DELETE /api/performance/:id  (place + all its photos) ─────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = db
      .prepare('SELECT id FROM performance_places WHERE id = ?')
      .get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Place not found.' });
    }

    // Delete all photos for this place
    const photos = db
      .prepare('SELECT file_path FROM performance_photos WHERE place_id = ?')
      .all(id);

    for (const p of photos) {
      await deleteAsset(p.file_path);
    }

    db.prepare('DELETE FROM performance_photos WHERE place_id = ?').run(id);
    db.prepare('DELETE FROM performance_places WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    console.error('[performance] DELETE place error:', err);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

// ── POST /api/performance/:id/photos  (upload → Cloudinary) ───
//    Multipart field:  file  (image), optional  caption
router.post(
  '/:id/photos',
  auth,
  makeUploader('performances', 'file', { allowedTypes: IMAGE_TYPES, maxFileSize: 15 * 1024 * 1024 }),
  async (req, res) => {
    const { id } = req.params;

    const place = db
      .prepare('SELECT id FROM performance_places WHERE id = ?')
      .get(id);
    if (!place) {
      cleanupLocalFile(req.file && req.file.path);
      return res.status(404).json({ error: 'Place not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided.' });
    }

    const caption = (req.body && req.body.caption) || '';
    const localPath = req.file.path;

    try {
      let storedUrl;

      if (CLOUDINARY_CONFIGURED) {
        const cResult = await uploadToCloudinary(localPath, {
          folder: `nruthyakrupa/performances`,
          resource_type: 'image',
        });
        storedUrl = cResult.secure_url;
        cleanupLocalFile(localPath);
      } else {
        const { publicPath } = require('../middleware/upload');
        storedUrl = publicPath('performances', req.file.filename);
      }

      const info = db
        .prepare(
          'INSERT INTO performance_photos (place_id, file_path, caption) VALUES (?, ?, ?)'
        )
        .run(id, storedUrl, caption);

      res.status(201).json({
        success: true,
        photo: { id: info.lastInsertRowid, place_id: id, file_path: storedUrl, caption },
      });
    } catch (err) {
      console.error('[performance] Photo upload error:', err);
      cleanupLocalFile(localPath);
      res.status(500).json({ error: 'Photo upload failed. ' + err.message });
    }
  }
);

// ── DELETE /api/performance/photos/:photoId ────────────────────
router.delete('/photos/:photoId', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const row = db
      .prepare('SELECT id, file_path FROM performance_photos WHERE id = ?')
      .get(photoId);

    if (!row) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    await deleteAsset(row.file_path);
    db.prepare('DELETE FROM performance_photos WHERE id = ?').run(photoId);

    res.json({ success: true });
  } catch (err) {
    console.error('[performance] DELETE photo error:', err);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;