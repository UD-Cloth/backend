import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromoCode,
} from '../controllers/promotionController';
import { protect, admin } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

// Sprint 6 / BUG-B-008: rate-limit /validate so attackers can't enumerate
// promo codes by brute force. Endpoint is intentionally public so the cart UI
// can pre-validate before checkout.
const validatePromoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many promo-code attempts, please try again shortly' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/validate', validatePromoLimiter, validatePromoCode);

router.route('/')
  .get(protect, admin, getPromotions)
  .post(protect, admin, createPromotion);

router.route('/:id')
  .put(protect, admin, validateObjectId('id'), updatePromotion)
  .delete(protect, admin, validateObjectId('id'), deletePromotion);

export default router;
