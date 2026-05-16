import express from 'express';
import rateLimit from 'express-rate-limit';
import { subscribe, getSubscribers, toggleStatus, removeSubscriber } from '../controllers/newsletterController';
import { protect, admin } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

// Sprint 2: rate-limit unauthenticated subscribe endpoint to prevent spam.
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many subscription attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/subscribe', subscribeLimiter, subscribe);
router.get('/', protect, admin, getSubscribers);
router.patch('/:id/toggle', protect, admin, validateObjectId('id'), toggleStatus);
router.delete('/:id', protect, admin, validateObjectId('id'), removeSubscriber);

export default router;
