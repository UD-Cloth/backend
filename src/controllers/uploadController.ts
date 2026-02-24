import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// @desc    Upload image
// @route   POST /api/upload
// @access  Private/Admin
export const uploadImage = (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.filename) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
