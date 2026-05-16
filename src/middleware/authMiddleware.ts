import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

// Sprint 7 / BUG-B-063: read JWT_SECRET once at module load. The Sprint 1 boot
// guard guarantees it's present and ≥16 chars, so we don't need to re-validate
// on every request.
const JWT_SECRET = process.env.JWT_SECRET as string;

const isObjectIdString = (raw: unknown): raw is string =>
  typeof raw === 'string' && mongoose.isValidObjectId(raw);

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.headers.authorization?.startsWith('Bearer')) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
  const token = req.headers.authorization.split(' ')[1];

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    // Sprint 7 / BUG-B-035: don't console.error on every bad token; that's
    // expected traffic when sessions expire. The 401 response is enough.
    res.status(401).json({ message: 'Not authorized, token failed' });
    return;
  }

  // Sprint 7 / BUG-B-036: defend against a token whose payload is a
  // sanitized-into-nothing object or some non-string id. Without this,
  // `User.findById({ $ne: null })` would hit a CastError and return 500.
  if (!isObjectIdString(decoded?.id)) {
    res.status(401).json({ message: 'Not authorized, malformed token payload' });
    return;
  }

  try {
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401).json({ message: 'Not authorized, user not found' });
      return;
    }
    if (user.isBlocked) {
      res.status(401).json({ message: 'Your account has been blocked. Please contact support.' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Same logic as `protect` but never blocks the request — silent on failure.
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer')) return next();
  const token = header.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (isObjectIdString(decoded?.id)) {
      const user = await User.findById(decoded.id).select('-password');
      if (user && !user.isBlocked) {
        req.user = user;
      }
    }
  } catch {
    // Sprint 7 / BUG-B-035: drop the noisy console.error; bad tokens here
    // are expected (logged-out users with stale storage) and the request
    // proceeds anonymously regardless.
  }
  next();
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  res.status(401).json({ message: 'Not authorized as an admin' });
};
