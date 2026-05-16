import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Sprint 2: Reject malformed Mongo ObjectIds with a 400 before they hit the controller.
 * Without this, a path like `/api/products/abc` would either trigger a CastError 500
 * (sometimes leaking error details) or be silently coerced. Now any `:param` listed
 * here that isn't a valid 24-char hex ObjectId returns 400 immediately.
 *
 * Usage: `router.get('/:id', validateObjectId('id'), handler)`
 */
export const validateObjectId =
  (...params: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    for (const p of params) {
      const raw = req.params[p];
      if (raw === undefined || raw === null) continue;
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (typeof value !== 'string') {
        res.status(400).json({ message: `Invalid ${p} format` });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(value) || String(new mongoose.Types.ObjectId(value)) !== value) {
        res.status(400).json({ message: `Invalid ${p} format` });
        return;
      }
    }
    next();
  };
