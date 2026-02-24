import express from 'express';
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


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only image files (jpeg, png, gif, webp) are allowed'));
  },
});

const router = express.Router();

router.post('/', protect, admin, upload.single('image'), uploadImage);

export default router;
