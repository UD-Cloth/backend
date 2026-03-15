import { Request, Response, NextFunction } from 'express';

export function errorLoggingMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Unknown error';
  const stack = err.stack || '';

  // Log error with full details
  console.error(`[${timestamp}] ERROR ${statusCode}`, {
    method,
    path,
    message,
    stack,
    body: req.body,
  });

  // Send error response
  if (!res.headersSent) {
    res.status(statusCode).json({
      error: message,
      statusCode,
      timestamp,
    });
  }
}
