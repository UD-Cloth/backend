import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Sprint 3: One-line replacement for the duplicated try/catch boilerplate
 * that wraps every controller. Express 5 already passes thrown async errors
 * to `next()`, so this is mostly defensive sugar — but it gives us a single
 * place to normalise CastError → 400 instead of leaking 500s.
 *
 * Usage:
 *   export const getThing = asyncHandler(async (req, res) => { ... });
 */
export const asyncHandler =
  <Req extends Request = Request>(
    fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as Req, res, next)).catch((err: any) => {
      // Translate the most common Mongoose validation surfaces to 4xx so
      // the global error logger doesn't flag every bad-input as a 500.
      if (err?.name === 'CastError') {
        res.status(400).json({ message: 'Invalid ID format' });
        return;
      }
      if (err?.name === 'ValidationError') {
        res.status(400).json({ message: err.message || 'Validation failed' });
        return;
      }
      // Duplicate-key (unique constraint) violations.
      if (err?.code === 11000) {
        res.status(409).json({ message: 'Duplicate value', keyValue: err.keyValue });
        return;
      }
      next(err);
    });
  };
