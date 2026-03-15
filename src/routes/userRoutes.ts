import express from 'express';
import { getUsers, deleteUser, updateUserRole, toggleUserBlock } from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/').get(protect, admin, getUsers);
router.route('/:id').delete(protect, admin, deleteUser);
router.route('/:id/role').put(protect, admin, updateUserRole);
router.route('/:id/block').put(protect, admin, toggleUserBlock);

export default router;
