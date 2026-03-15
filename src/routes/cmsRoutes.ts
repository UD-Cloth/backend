import express from 'express';
import {
  getCMS,
  updateHeroSlides,
  updatePromoBanner,
  updateTestimonials
} from '../controllers/cmsController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Public route to get CMS data
router.route('/')
  .get(getCMS);

// Admin only routes
router.route('/hero')
  .put(protect, admin, updateHeroSlides);

router.route('/promo')
  .put(protect, admin, updatePromoBanner);

router.route('/testimonials')
  .put(protect, admin, updateTestimonials);

export default router;
