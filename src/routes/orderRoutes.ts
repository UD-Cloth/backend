import express from 'express';
import { addOrderItems, getMyOrders, getOrders, getOrderById, updateOrderToDelivered } from '../controllers/orderController';
import { protect, admin, AuthRequest, optionalAuth } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/').post(optionalAuth, (req, res) => addOrderItems(req as AuthRequest, res)).get(protect, admin, getOrders);
router.route('/myorders').get(protect, (req, res) => getMyOrders(req as AuthRequest, res));
router.get('/:id', protect, (req, res) => getOrderById(req as AuthRequest, res));
router.route('/:id/deliver').put(protect, admin, updateOrderToDelivered);

export default router;
