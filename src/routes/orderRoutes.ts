import express from 'express';
import { addOrderItems, getMyOrders, getOrders, getOrderById, updateOrderToDelivered, updateOrderStatus, markOrderAsPaid, cancelOrder } from '../controllers/orderController';
import { protect, admin, AuthRequest, optionalAuth } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/').post(optionalAuth, (req, res) => addOrderItems(req as AuthRequest, res)).get(protect, admin, getOrders);
router.route('/myorders').get(protect, (req, res) => getMyOrders(req as AuthRequest, res));
router.get('/:id', protect, (req, res) => getOrderById(req as AuthRequest, res));
router.route('/:id/deliver').put(protect, admin, updateOrderToDelivered);
router.route('/:id/status').put(protect, admin, updateOrderStatus);
router.route('/:id/pay').put(protect, admin, markOrderAsPaid);
router.route('/:id/cancel').put(protect, (req, res) => cancelOrder(req as AuthRequest, res));

export default router;
