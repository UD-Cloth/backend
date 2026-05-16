import { Request, Response, NextFunction } from 'express';

// Sprint 1 / BUG-B-004 & BUG-B-005:
// 1. Strip Mongo operator keys ($gt, $ne, $where, etc.) and dotted keys before they reach the DB layer.
//    This blocks NoSQL-injection payloads like `{ "email": { "$gt": "" } }` on login/search endpoints.
// 2. Strip basic HTML tags from string values to mitigate stored XSS.

const FORBIDDEN_KEY_RE = /^\$|\./;

function stripForbiddenKeys(input: any): any {
  if (Array.isArray(input)) {
    return input.map(stripForbiddenKeys);
  }
  if (input !== null && typeof input === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(input)) {
      if (FORBIDDEN_KEY_RE.test(key)) {
        // Drop keys that start with $ or contain a dot — they're Mongo operators / path traversal.
        continue;
      }
      cleaned[key] = stripForbiddenKeys(input[key]);
    }
    return cleaned;
  }
  return input;
}

function sanitizeString(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&');
  }
  if (typeof input === 'object' && input !== null) {
    if (Array.isArray(input)) return input.map(sanitizeString);
    const sanitized: any = {};
    for (const key of Object.keys(input)) {
      sanitized[key] = sanitizeString(input[key]);
    }
    return sanitized;
  }
  return input;
}

export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1) Strip Mongo operator keys first (defense in depth).
  if (req.body && typeof req.body === 'object') {
    const cleaned = stripForbiddenKeys(req.body);
    // Replace contents in place so other middleware sees the cleaned object.
    for (const key of Object.keys(req.body)) delete (req.body as any)[key];
    Object.assign(req.body, cleaned);
  }
  if (req.query && typeof req.query === 'object') {
    const cleaned = stripForbiddenKeys(req.query);
    for (const key of Object.keys(req.query)) delete (req.query as any)[key];
    Object.assign(req.query, cleaned);
  }
  if (req.params && typeof req.params === 'object') {
    const cleaned = stripForbiddenKeys(req.params);
    for (const key of Object.keys(req.params)) delete (req.params as any)[key];
    Object.assign(req.params, cleaned);
  }

  // 2) Then HTML-strip strings.
  if (req.body) {
    const sanitizedBody = sanitizeString(req.body);
    Object.assign(req.body, sanitizedBody);
  }
  if (req.query) {
    const sanitizedQuery = sanitizeString(req.query);
    for (const key in sanitizedQuery) {
      (req.query as any)[key] = sanitizedQuery[key];
    }
  }
  if (req.params) {
    const sanitizedParams = sanitizeString(req.params);
    Object.assign(req.params, sanitizedParams);
  }

  next();
}
