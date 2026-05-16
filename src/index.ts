import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Force dotenv to load from the correct directory (only once)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import cors from 'cors';
import rateLimit from 'express-rate-limit';
// Bug #137: gzip responses to cut bandwidth on JSON list endpoints.
import compression from 'compression';

import connectDB from './config/db';
import { sanitizeMiddleware } from './middleware/sanitizeMiddleware';
import { errorLoggingMiddleware } from './middleware/errorLoggingMiddleware';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import cartRoutes from './routes/cartRoutes';
import categoryRoutes from './routes/categoryRoutes';
import statsRoutes from './routes/statsRoutes';
import contactRoutes from './routes/contactRoutes';
import uploadRoutes from './routes/uploadRoutes';
import userRoutes from './routes/userRoutes';
import cmsRoutes from './routes/cmsRoutes';
import newsletterRoutes from './routes/newsletterRoutes';
import promotionRoutes from './routes/promotionRoutes';
import abandonedCartRoutes from './routes/abandonedCartRoutes';
import settingsRoutes from './routes/settingsRoutes';
import reviewRoutes from './routes/reviewRoutes';

// Sprint 1 / BUG-B-001 + BUG-B-109 reinforcement:
// Hard-fail at boot if either critical secret is missing.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('FATAL: JWT_SECRET is missing or shorter than 16 characters');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('FATAL: MONGO_URI is not set');
  process.exit(1);
}
// Sprint 6 / BUG-B-029: in production we MUST have FRONTEND_URL set, otherwise
// every password-reset and email-verification email contains a localhost link.
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.error('FATAL: FRONTEND_URL must be set in production (used in reset/verify emails)');
  process.exit(1);
}

connectDB();

const app: Express = express();
const port = process.env.PORT || 5000;

// Sprint 4 / BUG-B-037: behind Vercel / Cloudflare / any reverse proxy,
// `req.ip` is the proxy's IP, so all clients share one rate-limit bucket.
// Trusting the first hop lets express-rate-limit see the real client IP via
// X-Forwarded-For. Set higher than 1 only if you stack multiple proxies.
app.set('trust proxy', 1);

// Bug #137: enable gzip/deflate compression for all responses.
app.use(compression());

// Sprint 1: Basic security headers (helmet equivalent without adding a dependency).
app.use((_req: Request, res: Response, next: any) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Bug #5: Restrict CORS to known origins in production.
// `.split(',').map(trim)` so a stray space in ALLOWED_ORIGINS doesn't silently
// drop an origin from the allowlist (a CORS rejection looks identical to a
// "missing entry" rejection in the browser, so this is easy to mis-diagnose).
const defaultProdOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://urban-drape.vercel.app',
  'https://urbandrape.in',
  'https://www.urbandrape.in',
];
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
// Outside production we union env-configured origins with the localhost
// defaults so dev tools running on alternate ports aren't blocked.
const allowedOrigins = (process.env.NODE_ENV === 'production'
  ? (envOrigins.length ? envOrigins : defaultProdOrigins)
  : Array.from(new Set([...defaultProdOrigins, ...envOrigins, 'http://localhost:5174', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173'])));

// Sprint 1: Use the same allowlist in dev as prod (just include localhost origins).
// The previous '*' in dev would echo any Origin and accept credentials elsewhere.
app.use(cors({
  // Allow same-origin / curl / server-to-server (no Origin header) plus the
  // explicit allowlist. Anything else is rejected.
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  // Sprint 7 fix: include PATCH. `api.patch` (added Sprint 7 for the admin
  // subscribers toggle) was failing preflight because PATCH wasn't listed.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Sprint 7 / BUG-B-058: include common headers the frontend may send so
  // preflight doesn't silently fail when adding tracing or XHR conventions.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept'],
  credentials: true,
}));

// Bug #84: Add rate limiting to protect against brute-force and DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth endpoints (login/register).
// In non-production environments and for localhost we relax the limit so dev/QA
// flows aren't locked out after a handful of attempts.
const isProduction = process.env.NODE_ENV === 'production';
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 20 : 1000,
  message: { message: 'Too many login/register attempts, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isProduction) return false;
    const ip = req.ip || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Bug #83: Add request body size limits to prevent RAM exhaustion attacks
app.use(express.json({ limit: '10mb' }));
// Bug #88: Add missing urlencoded middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Bug #8: Add input sanitization middleware to strip HTML/XSS
app.use(sanitizeMiddleware);

// Sprint 4 / BUG-B-034: previously a no-op CSRF stub lived here that emitted
// a token but never validated it. The API uses Bearer tokens (no cookies for
// auth), so CSRF is not the threat model — Bearer-only APIs are not vulnerable
// to classic CSRF. Removed the stub. If a cookie-based session is ever added,
// implement a real synchronizer-token / double-submit pattern at that point.

try {
  // Bug #165: Use consistent path relative to project root, not process.cwd()
  const uploadsDir = process.env.VERCEL === '1'
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, '..', '..', 'uploads');
  app.use('/uploads', express.static(uploadsDir));
} catch (_) { }

// Bug #136: Add Cache-Control middleware for public GET endpoints
app.use('/api/products', (req: Request, res: Response, next: any) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  }
  next();
});
app.use('/api/categories', (req: Request, res: Response, next: any) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=300');
  }
  next();
});

// Bug #166: Add /health endpoint for uptime monitoring
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'UD Project API is running' });
});

// Bug #129: Dynamic sitemap.xml endpoint
app.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const ProductM = (await import('./models/Product')).default;
    const CategoryM = (await import('./models/Category')).default;
    const baseUrl = process.env.FRONTEND_URL || 'https://www.urbandrape.in';
    const products = await ProductM.find({ status: 'active' }).select('_id').lean();
    const categories = await CategoryM.find({}).select('name').lean();
    const staticUrls = ['', '/new-arrivals', '/sale', '/trending', '/about', '/contact', '/faq', '/shipping', '/returns', '/size-guide', '/blog', '/careers', '/privacy', '/terms'];
    const nl = '\n';
    const xml = '<?xml version="1.0" encoding="UTF-8"?>' + nl +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + nl +
      staticUrls.map((u) => '  <url><loc>' + baseUrl + u + '</loc><changefreq>weekly</changefreq><priority>' + (u === '' ? '1.0' : '0.8') + '</priority></url>').join(nl) + nl +
      (categories as any[]).map((c) => '  <url><loc>' + baseUrl + '/category/' + encodeURIComponent(c.name) + '</loc><changefreq>daily</changefreq><priority>0.7</priority></url>').join(nl) + nl +
      (products as any[]).map((p) => '  <url><loc>' + baseUrl + '/product/' + p._id + '</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>').join(nl) + nl +
      '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/categories', categoryRoutes);
// Bug #52/#22/#152: Stats mounted at /admin so full path is /api/admin/stats (matches frontend)
apiRouter.use('/admin', statsRoutes);
apiRouter.use('/admin/users', userRoutes);
apiRouter.use('/contact', contactRoutes);
apiRouter.use('/cms', cmsRoutes);
apiRouter.use('/newsletter', newsletterRoutes);
apiRouter.use('/promotions', promotionRoutes);
apiRouter.use('/abandoned-carts', abandonedCartRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/reviews', reviewRoutes);

app.use('/api', apiRouter);
// Bug #11: Removed root-level fallback that exposed /products without /api prefix
// Unknown paths now correctly return 404 instead of silently routing
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Bug #90: Add error logging middleware to catch unhandled errors
app.use(errorLoggingMiddleware);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
