import express from 'express';
import { getProducts, getProductById, searchProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { getProductReviews, addReview } from '../controllers/reviewController';
import { protect, admin } from '../middleware/authMiddleware';
import { AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/').get(getProducts).post(protect, admin, createProduct);
router.get('/search', searchProducts);
router.route('/:id').get(getProductById).put(protect, admin, updateProduct).delete(protect, admin, deleteProduct);
router.get('/:id/reviews', getProductReviews);
router.post('/:id/reviews', protect, (req, res) => addReview(req as AuthRequest, res));

export default router;
