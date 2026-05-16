import express from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController';
import { protect, admin } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

router.route('/')
  .get(getCategories)
  .post(protect, admin, createCategory);

router.route('/:id')
  .put(protect, admin, validateObjectId('id'), updateCategory)
  .delete(protect, admin, validateObjectId('id'), deleteCategory);

export default router;
