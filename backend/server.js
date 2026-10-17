/*  backend/server.js
 *  ──────────────────
 *  Express entry point for Nruthya Krupa Academy API.
 *
 *  Changes for Cloudinary integration:
 *    – Added startup log confirming Cloudinary status.
 *    – Static /uploads serving preserved for legacy local files.
 *    – All route mounts and auth unchanged.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Core middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve legacy local uploads (existing /uploads/… DB records)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Cloudinary startup check ───────────────────────────────────
const { CLOUDINARY_CONFIGURED } = require('./middleware/upload');
if (CLOUDINARY_CONFIGURED) {
  console.log(
    `[server] ✓ Cloudinary active — new uploads will be stored in cloud "${process.env.CLOUDINARY_CLOUD_NAME}".`
  );
} else {
  console.warn(
    '[server] ⚠ Cloudinary not configured. New uploads will use local disk only ' +
      '(files will be lost on Render restart).'
  );
}

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/settings', require('./routes/settings'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/contact', require('./routes/contact'));

// Mount any additional routes that exist
const optionalRoutes = [
  'branches',
  'blogs',
  'footprints',
  'festivals',
  'faculty',
  'awards',
  'messages',
];
for (const name of optionalRoutes) {
  try {
    const routeModule = require(`./routes/${name}`);
    app.use(`/api/${name}`, routeModule);
  } catch (_e) {
    // Route file doesn't exist yet — skip silently
  }
}

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    cloudinary: CLOUDINARY_CONFIGURED,
    uptime: process.uptime(),
  });
});

// ── 404 ────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ── Global error handler ───────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Nruthya Krupa API listening on port ${PORT}`);
});

module.exports = app;