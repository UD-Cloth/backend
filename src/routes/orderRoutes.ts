import express from 'express';
import { addOrderItems, getMyOrders, getOrders, getOrderById, updateOrderToDelivered, updateOrderStatus, markOrderAsPaid, cancelOrder } from '../controllers/orderController';
import { protect, admin, AuthRequest } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = express.Router();

// Sprint 1 / BUG-B-012: POST /orders requires authentication.
router.route('/').post(protect, (req, res) => addOrderItems(req as AuthRequest, res)).get(protect, admin, getOrders);
router.route('/myorders').get(protect, (req, res) => getMyOrders(req as AuthRequest, res));
router.get('/:id', protect, validateObjectId('id'), (req, res) => getOrderById(req as AuthRequest, res));
router.route('/:id/deliver').put(protect, admin, validateObjectId('id'), updateOrderToDelivered);
router.route('/:id/status').put(protect, admin, validateObjectId('id'), updateOrderStatus);
router.route('/:id/pay').put(protect, admin, validateObjectId('id'), markOrderAsPaid);
router.route('/:id/cancel').put(protect, validateObjectId('id'), (req, res) => cancelOrder(req as AuthRequest, res));

export default router;
