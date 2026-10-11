const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { makeUploader, publicPath, UPLOAD_ROOT } = require('../middleware/upload');

/**
 * Builds a full CRUD router for a simple content table.
 * @param {string} table       SQL table name
 * @param {string} folder      uploads/<folder> for this resource's images
 * @param {string[]} fields    text/columns this resource has, besides id/image/sort_order
 */
function buildResourceRouter(table, folder, fields) {
  const router = express.Router();
  const upload = makeUploader(folder, { allowVideo: false, maxSizeMB: 20 });

  // GET / — public, list everything in order
  router.get('/', (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY sort_order ASC, id ASC`).all();
    res.json(rows);
  });

  // POST / — admin only, multipart form with optional 'image' file + text fields
  router.post('/', requireAdmin, upload.single('image'), (req, res) => {
    const values = fields.map(f => req.body[f] ?? '');
    const image = req.file ? publicPath(folder, req.file.filename) : (req.body.image || '');
    const sort_order = Number(req.body.sort_order) || 0;

    const columns = [...fields, 'image', 'sort_order'];
    const placeholders = columns.map(() => '?').join(', ');
    const info = db.prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    ).run(...values, image, sort_order);

    res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid));
  });

  // PUT /:id — admin only, multipart or JSON. Replaces image only if a new one is sent.
  router.put('/:id', requireAdmin, upload.single('image'), (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });

    const values = fields.map(f => (req.body[f] !== undefined ? req.body[f] : existing[f]));
    let image = existing.image;
    if (req.file) {
      // remove old file if it lived in our uploads folder
      if (existing.image && existing.image.startsWith('/uploads/')) {
        fs.unlink(path.join(UPLOAD_ROOT, existing.image.replace('/uploads/', '')), () => {});
      }
      image = publicPath(folder, req.file.filename);
    }
    const sort_order = req.body.sort_order !== undefined ? Number(req.body.sort_order) : existing.sort_order;

    const setClause = [...fields, 'image', 'sort_order'].map(c => `${c} = ?`).join(', ');
    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, image, sort_order, existing.id);

    res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(existing.id));
  });

  // DELETE /:id — admin only
  router.delete('/:id', requireAdmin, (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });

    if (existing.image && existing.image.startsWith('/uploads/')) {
      fs.unlink(path.join(UPLOAD_ROOT, existing.image.replace('/uploads/', '')), () => {});
    }
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(existing.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = buildResourceRouter;
