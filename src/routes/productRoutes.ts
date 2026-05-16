import express from 'express';
import { getProducts, getProductById, searchProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { getProductReviews, addReview } from '../controllers/reviewController';
import { protect, admin } from '../middleware/authMiddleware';
import { AuthRequest } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Sprint 2: Rate-limit review submissions per IP to prevent spam.
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many reviews submitted, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sprint 7 / BUG-B-057: rate-limit /products/search since it runs an
// unindexed regex fallback under the hood. 60/min is generous for genuine
// typeahead but blocks scraping.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many search requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.route('/').get(getProducts).post(protect, admin, createProduct);
router.get('/search', searchLimiter, searchProducts);
router.route('/:id')
  .get(validateObjectId('id'), getProductById)
  .put(protect, admin, validateObjectId('id'), updateProduct)
  .delete(protect, admin, validateObjectId('id'), deleteProduct);
router.get('/:id/reviews', validateObjectId('id'), getProductReviews);
router.post('/:id/reviews', protect, validateObjectId('id'), reviewLimiter, (req, res) => addReview(req as AuthRequest, res));

export default router;
