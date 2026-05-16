import { Request, Response, NextFunction } from 'express';

// Sprint 1 / BUG-B-100: Never log req.body — it contains passwords, tokens, payment details.
// Log only safe metadata; redact sensitive headers.

const SENSITIVE_FIELDS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'authorization',
  'cookie',
]);

function safePreview(body: any): any {
  if (!body || typeof body !== 'object') return undefined;
  const preview: Record<string, any> = {};
  for (const key of Object.keys(body)) {
    preview[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : '[present]';
  }
  return preview;
}

export function errorLoggingMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Unknown error';
  const isProd = process.env.NODE_ENV === 'production';

  console.error(`[${timestamp}] ERROR ${statusCode}`, {
    method,
    path,
    message,
    // Stack only in non-prod; just keys (redacted) of the body, never values.
    ...(isProd ? {} : { stack: err.stack }),
    bodyKeys: safePreview(req.body),
  });

  if (!res.headersSent) {
    res.status(statusCode).json({
      error: isProd ? 'Internal server error' : message,
      statusCode,
      timestamp,
    });
  }
}
