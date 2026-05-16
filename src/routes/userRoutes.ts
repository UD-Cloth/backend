import express from 'express';
import { getUsers, deleteUser, updateUserRole, toggleUserBlock } from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

router.route('/').get(protect, admin, getUsers);
router.route('/:id').delete(protect, admin, validateObjectId('id'), deleteUser);
router.route('/:id/role').put(protect, admin, validateObjectId('id'), updateUserRole);
router.route('/:id/block').put(protect, admin, validateObjectId('id'), toggleUserBlock);

export default router;
