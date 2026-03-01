import express from 'express';
import { authUser, registerUser, getUserProfile, getUserDashboard, updateUserProfile, getWishlist, toggleWishlist } from '../controllers/authController';
import { protect, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.get('/profile', protect, (req, res) => getUserProfile(req as AuthRequest, res));
router.get('/dashboard', protect, (req, res) => getUserDashboard(req as AuthRequest, res));
router.put('/profile', protect, (req, res) => updateUserProfile(req as AuthRequest, res));
router.get('/wishlist', protect, (req, res) => getWishlist(req as AuthRequest, res));
router.post('/wishlist', protect, (req, res) => toggleWishlist(req as AuthRequest, res));

export default router;
