import express from 'express';
import { authUser, registerUser, getUserProfile, getUserDashboard, updateUserProfile, getWishlist, toggleWishlist } from '../controllers/authController';
import { protect, AuthRequest } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Bug #3 & #4: Rate limiting on login and registration
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: false,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per window
  message: 'Too many registration attempts, please try again later',
  standardHeaders: false,
  legacyHeaders: false,
});

router.post('/register', registerLimiter, registerUser);
router.post('/login', loginLimiter, authUser);
router.get('/profile', protect, (req, res) => getUserProfile(req as AuthRequest, res));
router.get('/dashboard', protect, (req, res) => getUserDashboard(req as AuthRequest, res));
router.put('/profile', protect, (req, res) => updateUserProfile(req as AuthRequest, res));
router.get('/wishlist', protect, (req, res) => getWishlist(req as AuthRequest, res));
router.post('/wishlist', protect, (req, res) => toggleWishlist(req as AuthRequest, res));

export default router;
