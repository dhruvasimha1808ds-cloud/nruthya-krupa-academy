/*  backend/middleware/upload.js
 *  ─────────────────────────────
 *  Multer disk-staging + Cloudinary upload helpers.
 *
 *  Flow for every new upload:
 *    1. Multer writes to backend/uploads/<subfolder>/  (staging)
 *    2. Route handler calls uploadToCloudinary(req.file.path, …)
 *    3. Cloudinary secure_url is stored in SQLite
 *    4. Local staging file is deleted via cleanupLocalFile()
 *
 *  Legacy /uploads/… paths already in the database continue to
 *  work unchanged — they are served by Express static middleware.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Cloudinary SDK ──────────────────────────────────────────────
const cloudinary = require('cloudinary').v2;

const CLOUDINARY_CONFIGURED = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log(
    `[cloudinary] Configured for cloud "${process.env.CLOUDINARY_CLOUD_NAME}".`
  );
} else {
  console.warn(
    '[cloudinary] CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET not all set. ' +
      'New uploads will fall back to local-only storage.'
  );
}

// ── Paths ───────────────────────────────────────────────────────
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
ensureDir(UPLOAD_ROOT);

// ── Multer disk storage (staging) ──────────────────────────────
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const sub = _req._uploadSubfolder || 'temp';
    const dir = path.join(UPLOAD_ROOT, sub);
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const tag = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}-${tag}${ext}`);
  },
});

// ── Allowed MIME types ─────────────────────────────────────────
const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALL_MEDIA = [...IMAGE_TYPES, ...VIDEO_TYPES];

function fileFilter(req, file, cb) {
  const allowed = req._allowedTypes || ALL_MEDIA;
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(`File type "${file.mimetype}" is not allowed. Accepted: ${allowed.join(', ')}`),
      false
    );
  }
}

// ── Multer factory ─────────────────────────────────────────────
/**
 * Returns Express middleware that parses a single file upload.
 *
 * @param {string} subfolder  – directory under backend/uploads/
 * @param {string} fieldName  – multipart field name ("file", "image", "photo")
 * @param {object} [opts]
 * @param {number} [opts.maxFileSize]  – bytes (default 100 MB)
 * @param {string[]} [opts.allowedTypes] – MIME whitelist
 */
function makeUploader(subfolder, fieldName = 'file', opts = {}) {
  const { maxFileSize = 100 * 1024 * 1024, allowedTypes } = opts;

  return (req, res, next) => {
    req._uploadSubfolder = subfolder;
    if (allowedTypes) req._allowedTypes = allowedTypes;

    const instance = multer({
      storage,
      fileFilter,
      limits: { fileSize: maxFileSize },
    });

    instance.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
}

// ── Legacy path helper (still used by old records) ─────────────
function publicPath(subfolder, filename) {
  return `/uploads/${subfolder}/${filename}`;
}

// ── Cloudinary helpers ─────────────────────────────────────────

/**
 * Upload a local file to Cloudinary.
 *
 * @param {string} localPath  – absolute path to the staged file
 * @param {object} [opts]
 * @param {string} [opts.folder]       – Cloudinary folder (default "nruthyakrupa")
 * @param {string} [opts.resource_type] – "auto" | "image" | "video"
 * @returns {Promise<{secure_url: string, public_id: string, resource_type: string}>}
 */
async function uploadToCloudinary(localPath, opts = {}) {
  if (!CLOUDINARY_CONFIGURED) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  }

  const folder = opts.folder || 'nruthyakrupa';
  const resourceType = opts.resource_type || 'auto';

  // For files > 100 MB use chunked upload; otherwise standard upload.
  const stat = fs.statSync(localPath);
  const useChunked = stat.size > 100 * 1024 * 1024;

  const uploadOpts = {
    folder,
    resource_type: resourceType,
    timeout: 120000, // 2 min for large videos
  };

  let result;
  if (useChunked) {
    result = await cloudinary.uploader.upload_large(localPath, {
      ...uploadOpts,
      chunk_size: 20 * 1024 * 1024, // 20 MB chunks
    });
  } else {
    result = await cloudinary.uploader.upload(localPath, uploadOpts);
  }

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
  };
}

/** True when the string looks like a Cloudinary URL. */
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /res\.cloudinary\.com\//i.test(url);
}

/**
 * Extract the public_id from a Cloudinary secure_url.
 *
 * Example:
 *   https://res.cloudinary.com/peyyfh7b/image/upload/v1719000000/nruthyakrupa/gallery/abc.jpg
 *   → "nruthyakrupa/gallery/abc"
 */
function extractPublicId(url) {
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  return m ? m[1] : null;
}

/** Extract resource_type segment ("image" | "video" | "raw") from URL. */
function extractResourceType(url) {
  const m = url.match(/cloudinary\.com\/[^/]+\/(image|video|raw)\//i);
  return m ? m[1].toLowerCase() : 'image';
}

/**
 * Delete a Cloudinary asset by its URL.
 * Returns true on success, false if the URL is not a Cloudinary URL
 * or deletion failed.
 */
async function deleteCloudinaryAsset(url) {
  if (!isCloudinaryUrl(url)) return false;
  const publicId = extractPublicId(url);
  const resourceType = extractResourceType(url);
  if (!publicId) return false;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return true;
  } catch (err) {
    console.error(`[cloudinary] destroy failed for "${publicId}":`, err.message);
    return false;
  }
}

/**
 * Delete a local staging file.  Silently ignores missing files.
 */
function cleanupLocalFile(localPath) {
  try {
    if (localPath && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch (err) {
    console.warn(`[upload] Could not remove local file "${localPath}":`, err.message);
  }
}

/**
 * Unified delete helper: handles both Cloudinary URLs and legacy
 * local /uploads/… paths.
 *
 * @param {string} storedPath – value from the database
 * @param {string} [localBase] – absolute base dir for local files
 */
async function deleteAsset(storedPath, localBase) {
  if (!storedPath) return false;

  if (isCloudinaryUrl(storedPath)) {
    return deleteCloudinaryAsset(storedPath);
  }

  // Legacy local path
  const base = localBase || UPLOAD_ROOT;
  // storedPath looks like "/uploads/gallery/abc.jpg"
  const rel = storedPath.replace(/^\/+/, '');
  const abs = path.join(base, '..', rel); // base is …/uploads, go up one to backend/
  try {
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      return true;
    }
  } catch (err) {
    console.warn(`[upload] Could not delete local asset "${abs}":`, err.message);
  }
  return false;
}

// ── Exports ─────────────────────────────────────────────────────
module.exports = {
  UPLOAD_ROOT,
  makeUploader,
  publicPath,
  uploadToCloudinary,
  deleteCloudinaryAsset,
  deleteAsset,
  isCloudinaryUrl,
  extractPublicId,
  extractResourceType,
  cleanupLocalFile,
  CLOUDINARY_CONFIGURED,
  IMAGE_TYPES,
  VIDEO_TYPES,
  ALL_MEDIA,
};
