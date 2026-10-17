
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const {
  makeUploader,
  publicPath,
  UPLOAD_ROOT,
  uploadToCloudinary,
  cleanupLocalFile
} = require('../middleware/upload');

function buildResourceRouter(table, folder, fields) {
  const router = express.Router();

  const upload = makeUploader(folder, 'image', {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxFileSize: 20 * 1024 * 1024
  });

  router.get('/', (req, res) => {
    const rows = db.prepare(
      `SELECT * FROM ${table} ORDER BY sort_order ASC, id ASC`
    ).all();

    res.json(rows);
  });

  router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
    let image = req.body.image || '';

    try {
      const values = fields.map(f => req.body[f] ?? '');
      const sort_order = Number(req.body.sort_order) || 0;

      if (req.file) {
        if (process.env.NODE_ENV === 'production' &&
            !process.env.CLOUDINARY_CLOUD_NAME) {
          await cleanupLocalFile(req.file.path);
          return res.status(503).json({
            error: 'Cloud image storage is not configured.'
          });
        }

        if (process.env.CLOUDINARY_CLOUD_NAME) {
          const result = await uploadToCloudinary(req.file.path, { folder });
          image = result.secure_url;
          await cleanupLocalFile(req.file.path);
        } else {
          image = publicPath(folder, req.file.filename);
        }
      }

      const columns = [...fields, 'image', 'sort_order'];
      const placeholders = columns.map(() => '?').join(', ');

      const info = db.prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      ).run(...values, image, sort_order);

      res.status(201).json(
        db.prepare(`SELECT * FROM ${table} WHERE id = ?`)
          .get(info.lastInsertRowid)
      );
    } catch (err) {
      if (req.file) await cleanupLocalFile(req.file.path).catch(() => {});
      console.error('[resourceFactory] Create failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Unable to save this item.' });
      }
    }
  });

  router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
    const existing = db.prepare(
      `SELECT * FROM ${table} WHERE id = ?`
    ).get(req.params.id);

    if (!existing) {
      if (req.file) await cleanupLocalFile(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Not found.' });
    }

    try {
      const values = fields.map(
        f => req.body[f] !== undefined ? req.body[f] : existing[f]
      );

      let image = existing.image || '';

      if (req.file) {
        if (process.env.NODE_ENV === 'production' &&
            !process.env.CLOUDINARY_CLOUD_NAME) {
          await cleanupLocalFile(req.file.path);
          return res.status(503).json({
            error: 'Cloud image storage is not configured.'
          });
        }

        if (process.env.CLOUDINARY_CLOUD_NAME) {
          const result = await uploadToCloudinary(req.file.path, { folder });
          image = result.secure_url;
          await cleanupLocalFile(req.file.path);
        } else {
          image = publicPath(folder, req.file.filename);
        }
      }

      const sort_order = req.body.sort_order !== undefined
        ? Number(req.body.sort_order)
        : existing.sort_order;

      const setClause = [...fields, 'image', 'sort_order']
        .map(c => `${c} = ?`).join(', ');

      db.prepare(
        `UPDATE ${table} SET ${setClause} WHERE id = ?`
      ).run(...values, image, sort_order, existing.id);

      res.json(
        db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(existing.id)
      );
    } catch (err) {
      if (req.file) await cleanupLocalFile(req.file.path).catch(() => {});
      console.error('[resourceFactory] Update failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Unable to update this item.' });
      }
    }
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const existing = db.prepare(
      `SELECT * FROM ${table} WHERE id = ?`
    ).get(req.params.id);

    if (!existing) return res.status(404).json({ error: 'Not found.' });

    if (existing.image && existing.image.startsWith('/uploads/')) {
      fs.unlink(
        path.join(UPLOAD_ROOT, existing.image.replace('/uploads/', '')),
        () => {}
      );
    }

    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(existing.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = buildResourceRouter;

