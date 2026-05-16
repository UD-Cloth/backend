import express from 'express';
import rateLimit from 'express-rate-limit';
import { submitContact } from '../controllers/contactController';

const router = express.Router();

// Sprint 2: Rate-limit unauthenticated contact form to prevent spam abuse.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Too many contact form submissions, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', contactLimiter, submitContact);

export default router;
