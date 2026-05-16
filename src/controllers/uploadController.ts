import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
// Bug #124: image compression — resize huge uploads + re-encode to keep
// page-load fast. Falls back gracefully if `sharp` isn't installed (e.g. on
// constrained CI tiers); compression then becomes a no-op rather than failing.
let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharp = require('sharp');
} catch { /* sharp not installed */ }

const MAX_IMAGE_DIMENSION = 1600; // px on longest side
const JPEG_QUALITY = 82;

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.NODE_ENV === 'production';
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (error) {
    console.warn('Could not create uploads directory (read-only filesystem):', error);
  }
}


// @desc    Upload image
// @route   POST /api/upload
// @access  Private/Admin
// Bug #9: Validate file MIME type
// Bug #124: Compress image after upload (resize + re-encode)
// Bug #156: Return proper production URLs instead of localhost
export const uploadImage = async (req: Request, res: Response) => {
  // Bug #194: if anything below throws *after* multer wrote the file, delete
  // the orphaned file before responding so /tmp/uploads doesn't fill up.
  const cleanupOrphan = () => {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => { /* swallow — best-effort */ });
    }
  };

  try {
    if (!req.file || !req.file.filename) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    // MIME type validation is handled by multer fileFilter in routes
    // Construct the proper base URL from request headers or environment
    let baseUrl = process.env.BASE_URL;

    // If not set, try to determine from request origin or host
    if (!baseUrl) {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
      baseUrl = `${protocol}://${host}`;
    }

    // Bug #124: compress in-place. Skip silently if sharp is unavailable or
    // the file is already small (≤200 KB) — sharp on a tiny PNG is wasteful.
    if (sharp && req.file.size > 200 * 1024) {
      try {
        const inputPath = req.file.path;
        const ext = (path.extname(inputPath) || '.jpg').toLowerCase();
        const tmpOut = inputPath + '.compressed';
        let pipeline = sharp(inputPath).rotate().resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        });
        if (ext === '.png') pipeline = pipeline.png({ compressionLevel: 9 });
        else if (ext === '.webp') pipeline = pipeline.webp({ quality: JPEG_QUALITY });
        else pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
        await pipeline.toFile(tmpOut);
        await fs.promises.rename(tmpOut, inputPath);
      } catch (e) {
        // Compression is best-effort — log but still return the original.
        console.warn('[upload] sharp compression failed, serving original', e);
      }
    }

    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    cleanupOrphan();
    res.status(500).json({ message: 'Server Error' });
  }
};
