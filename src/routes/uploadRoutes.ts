import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadImage } from '../controllers/uploadController';
import { protect, admin } from '../middleware/authMiddleware';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.NODE_ENV === 'production';
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (error) {
    console.warn('Could not create uploads directory (read-only filesystem):', error);
  }
}

// Sprint 2: Hardened file upload.
// - Whitelist BOTH extension and MIME type. SVG is excluded — SVGs can carry XSS.
// - Filename is fully random (crypto.randomBytes), not derived from user input.
// - Extension is forced from the MIME map; the original filename never touches disk.
// - 5 MB cap (existing).

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeExt = MIME_TO_EXT[file.mimetype.toLowerCase()] || '.bin';
    const random = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${random}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mimeOk = !!MIME_TO_EXT[file.mimetype.toLowerCase()];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.has(ext);
    if (!mimeOk || !extOk) {
      cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed (SVG is not allowed)'));
      return;
    }
    cb(null, true);
  },
});

const router = express.Router();

router.post(
  '/',
  protect,
  admin,
  (req, res, next) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        // Translate multer errors to 400 instead of bubbling up as 500.
        const isLimit = err.code === 'LIMIT_FILE_SIZE';
        res.status(400).json({
          message: isLimit ? 'File too large (max 5 MB)' : err.message || 'Upload failed',
        });
        return;
      }
      next();
    });
  },
  uploadImage
);

export default router;
