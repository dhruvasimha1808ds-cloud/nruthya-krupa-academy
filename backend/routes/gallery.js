/*  backend/routes/gallery.js
 *  ──────────────────────────
 *  GET    /api/gallery?category=   – public, filtered gallery items
 *  POST   /api/gallery             – admin, upload image/video → Cloudinary
 *  PUT    /api/gallery/:id         – admin, update title/caption
 *  DELETE /api/gallery/:id         – admin, delete asset + DB row
 */

const express = require('express');
const router = express.Router();

const db = require('../db/database');
const { requireAdmin: auth } = require('../middleware/auth');
const {
  makeUploader,
  uploadToCloudinary,
  deleteAsset,
  isCloudinaryUrl,
  cleanupLocalFile,
  CLOUDINARY_CONFIGURED,
  ALL_MEDIA,
} = require('../middleware/upload');

const VALID_CATEGORIES = new Set(['photo', 'video', 'gejje_pooje', 'media']);

// ── GET /api/gallery ───────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const category = req.query.category || 'photo';
    let rows;

    if (VALID_CATEGORIES.has(category)) {
      rows = db
        .prepare(
          'SELECT id, file_path, media_type, title, caption, category, created_at ' +
            'FROM gallery_items WHERE category = ? ORDER BY created_at DESC'
        )
        .all(category);
    } else {
      rows = db
        .prepare(
          'SELECT id, file_path, media_type, title, caption, category, created_at ' +
            'FROM gallery_items ORDER BY created_at DESC'
        )
        .all();
    }

    res.json(rows);
  } catch (err) {
    console.error('[gallery] GET error:', err);
    res.status(500).json({ error: 'Failed to load gallery.' });
  }
});

// ── POST /api/gallery  (upload → Cloudinary) ──────────────────
//    Multipart fields:  file  (image or video),  title,  caption,  category
router.post(
  '/',
  auth,
  makeUploader('gallery', 'file', { allowedTypes: ALL_MEDIA, maxFileSize: 200 * 1024 * 1024 }),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { title = '', caption = '', category = 'photo' } = req.body || {};
    const safeCategory = VALID_CATEGORIES.has(category) ? category : 'photo';
    const isVideo = req.file.mimetype.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'image';
    const localPath = req.file.path;

    try {
      let storedUrl;

      if (CLOUDINARY_CONFIGURED) {
        const cResult = await uploadToCloudinary(localPath, {
          folder: `nruthyakrupa/gallery`,
          resource_type: 'auto', // Cloudinary detects image vs video
        });
        storedUrl = cResult.secure_url;
        cleanupLocalFile(localPath);
      } else {
        const { publicPath } = require('../middleware/upload');
        storedUrl = publicPath('gallery', req.file.filename);
      }

      const info = db
        .prepare(
          'INSERT INTO gallery_items (file_path, media_type, title, caption, category) ' +
            'VALUES (?, ?, ?, ?, ?)'
        )
        .run(storedUrl, mediaType, title, caption, safeCategory);

      res.status(201).json({
        success: true,
        item: {
          id: info.lastInsertRowid,
          file_path: storedUrl,
          media_type: mediaType,
          title,
          caption,
          category: safeCategory,
        },
      });
    } catch (err) {
      console.error('[gallery] POST error:', err);
      cleanupLocalFile(localPath);
      res.status(500).json({ error: 'Gallery upload failed. ' + err.message });
    }
  }
);

// ── PUT /api/gallery/:id  (update metadata only) ──────────────
router.put('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { title, caption, category } = req.body || {};

    const existing = db
      .prepare('SELECT id FROM gallery_items WHERE id = ?')
      .get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Gallery item not found.' });
    }

    const sets = [];
    const vals = [];
    if (title !== undefined) {
      sets.push('title = ?');
      vals.push(title);
    }
    if (caption !== undefined) {
      sets.push('caption = ?');
      vals.push(caption);
    }
    if (category !== undefined && VALID_CATEGORIES.has(category)) {
      sets.push('category = ?');
      vals.push(category);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    vals.push(id);
    db.prepare(`UPDATE gallery_items SET ${sets.join(', ')} WHERE id = ?`).run(
      ...vals
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[gallery] PUT error:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

// ── DELETE /api/gallery/:id ────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const row = db
      .prepare('SELECT id, file_path FROM gallery_items WHERE id = ?')
      .get(id);

    if (!row) {
      return res.status(404).json({ error: 'Gallery item not found.' });
    }

    // Delete the actual asset (Cloudinary or local)
    await deleteAsset(row.file_path);

    db.prepare('DELETE FROM gallery_items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[gallery] DELETE error:', err);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;
