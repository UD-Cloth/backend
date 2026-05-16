import express from 'express';
import { getAllReviews, deleteReview } from '../controllers/reviewController';
import { protect, admin } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

router.get('/', protect, admin, getAllReviews);
router.delete('/:id', protect, admin, validateObjectId('id'), deleteReview);

export default router;
