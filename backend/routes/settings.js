/*  backend/routes/settings.js
 *  ────────────────────────────
 *  GET  /api/settings          – public, returns all key/value pairs
 *  PUT  /api/settings          – admin, updates text values
 *  PUT  /api/settings/image    – admin, uploads a single image to Cloudinary
 *                                and stores the secure_url for the given key.
 *
 *  Image keys: guru_portrait, scholarship_image, site_logo,
 *              hero_image, site_background
 */

const express = require('express');
const router = express.Router();
const path = require('path');

const db = require('../db/database');
const { requireAdmin: auth } = require('../middleware/auth');
const {
  makeUploader,
  uploadToCloudinary,
  deleteCloudinaryAsset,
  isCloudinaryUrl,
  cleanupLocalFile,
  CLOUDINARY_CONFIGURED,
  IMAGE_TYPES,
} = require('../middleware/upload');

// ── Helpers ─────────────────────────────────────────────────────
const IMAGE_KEYS = new Set([
  'guru_portrait',
  'scholarship_image',
  'site_logo',
  'hero_image',
  'site_background',
]);

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// ── GET /api/settings ──────────────────────────────────────────
router.get('/', (_req, res) => {
  try {
    res.json(getAllSettings());
  } catch (err) {
    console.error('[settings] GET error:', err);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

// ── PUT /api/settings  (text-only values) ──────────────────────
router.put('/', auth, (req, res) => {
  try {
    const body = req.body || {};
    const upsert = db.prepare(
      'INSERT INTO site_settings (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );

    const tx = db.transaction((entries) => {
      for (const [k, v] of Object.entries(entries)) {
        if (typeof v === 'string') {
          upsert.run(k, v);
        }
      }
    });

    tx(body);
    res.json({ success: true, settings: getAllSettings() });
  } catch (err) {
    console.error('[settings] PUT error:', err);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// ── PUT /api/settings/image  (single image upload → Cloudinary) ─
//    Multipart fields:  image  (file),  key  (text – one of IMAGE_KEYS)
router.put(
  '/image',
  auth,
  makeUploader('settings', 'image', { allowedTypes: IMAGE_TYPES, maxFileSize: 10 * 1024 * 1024 }),
  async (req, res) => {
    const key = req.body && req.body.key;

    if (!key || !IMAGE_KEYS.has(key)) {
      cleanupLocalFile(req.file && req.file.path);
      return res.status(400).json({
        error: `Invalid image key. Must be one of: ${[...IMAGE_KEYS].join(', ')}`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const localPath = req.file.path;

    try {
      let storedUrl;

      if (CLOUDINARY_CONFIGURED) {
        const cResult = await uploadToCloudinary(localPath, {
          folder: `nruthyakrupa/settings`,
          resource_type: 'image',
        });
        storedUrl = cResult.secure_url;

        // Delete previous Cloudinary asset if the old value was a Cloudinary URL
        const oldRow = db
          .prepare('SELECT value FROM site_settings WHERE key = ?')
          .get(key);
        if (oldRow && isCloudinaryUrl(oldRow.value)) {
          await deleteCloudinaryAsset(oldRow.value);
        }

        cleanupLocalFile(localPath);
      } else {
        // Fallback: keep local file, store relative path
        const { publicPath } = require('../middleware/upload');
        storedUrl = publicPath('settings', req.file.filename);
      }

      db.prepare(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).run(key, storedUrl);

      res.json({ success: true, key, value: storedUrl, settings: getAllSettings() });
    } catch (err) {
      console.error('[settings] Image upload error:', err);
      cleanupLocalFile(localPath);
      res.status(500).json({ error: 'Image upload failed. ' + err.message });
    }
  }
);

module.exports = router;
