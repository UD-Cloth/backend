import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  logAbandonedCart,
  getAbandonedCarts,
  deleteAbandonedCart,
} from '../controllers/abandonedCartController';
import { protect, admin } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

// Sprint 2: This is an unauthenticated POST endpoint — rate limit aggressively.
const abandonedCartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.route('/')
  .post(abandonedCartLimiter, logAbandonedCart)
  .get(protect, admin, getAbandonedCarts);

router.delete('/:id', protect, admin, validateObjectId('id'), deleteAbandonedCart);

export default router;
