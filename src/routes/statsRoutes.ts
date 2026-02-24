import express from 'express';
import { getStats } from '../controllers/statsController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/stats', protect, admin, getStats);

export default router;
