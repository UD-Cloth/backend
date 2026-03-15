import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

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
// Bug #156: Return proper production URLs instead of localhost
export const uploadImage = (req: Request, res: Response) => {
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

    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
