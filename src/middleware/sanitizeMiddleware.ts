import { Request, Response, NextFunction } from 'express';

// Simple HTML/XSS tag stripper for input fields
function sanitizeString(input: any): any {
  if (typeof input === 'string') {
    // Remove HTML tags and decode entities
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&');
  }
  if (typeof input === 'object' && input !== null) {
    if (Array.isArray(input)) {
      return input.map(sanitizeString);
    }
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeString(input[key]);
    }
    return sanitized;
  }
  return input;
}

export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
  // Sanitize request body
  if (req.body) {
    const sanitizedBody = sanitizeString(req.body);
    // Use Object.assign to modify the object reference rather than reassigning it
    Object.assign(req.body, sanitizedBody);
  }

  // Sanitize query parameters
  if (req.query) {
    const sanitizedQuery = sanitizeString(req.query);
    // Express req.query is often a getter/setter combo or read-only reference
    // Update individual keys instead of reassigning req.query
    for (const key in sanitizedQuery) {
      (req.query as any)[key] = sanitizedQuery[key];
    }
  }

  // Sanitize URL parameters
  if (req.params) {
    const sanitizedParams = sanitizeString(req.params);
    Object.assign(req.params, sanitizedParams);
  }

  next();
}
