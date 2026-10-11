const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const ALLOWED_IMAGE = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const ALLOWED_VIDEO = ['.mp4', '.mov', '.webm'];

function makeUploader(subfolder, { allowVideo = false, maxSizeMB = 50 } = {}) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${unique}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = allowVideo ? [...ALLOWED_IMAGE, ...ALLOWED_VIDEO] : ALLOWED_IMAGE;
    if (!allowed.includes(ext)) {
      return cb(new Error(`File type ${ext} is not allowed here.`));
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 }
  });
}

// Public URL path for a stored file
function publicPath(subfolder, filename) {
  return `/uploads/${subfolder}/${filename}`;
}

module.exports = { makeUploader, publicPath, UPLOAD_ROOT };
