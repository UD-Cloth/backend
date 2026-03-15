import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const addOrderItems = async (req: AuthRequest, res: Response) => {
  try {
    const { orderItems, shippingAddress, paymentMethod } = req.body;

    if (!orderItems || orderItems.length === 0) {
      res.status(400).json({ message: 'No order items' });
      return;
    }

    // Bug #13: Validate stock and Bug #17: Recalculate prices server-side
    let calculatedItemsPrice = 0;
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        res.status(404).json({ message: `Product not found: ${item.product}` });
        return;
      }
      // Bug #16: Block inactive products from being ordered
      if (product.status === 'inactive') {
        res.status(400).json({ message: `Product "${product.name}" is no longer available` });
        return;
      }
      // Bug #13: Check stock
      if (product.stock !== undefined && product.stock < item.qty) {
        res.status(400).json({ message: `Insufficient stock for "${product.name}". Available: ${product.stock}` });
        return;
      }
      // Bug #17: Use server-side price, not frontend price
      item.price = product.price;
      calculatedItemsPrice += product.price * item.qty;
    }

    // Bug #39: Recalculate tax and shipping server-side
    const taxPrice = Math.round(calculatedItemsPrice * 0.1 * 100) / 100;
    const shippingPrice = calculatedItemsPrice > 2000 ? 0 : 150;
    const totalPrice = calculatedItemsPrice + taxPrice + shippingPrice;

    // Bug #43: Save customer email and phone for order fulfillment
    const customerEmail = req.body.customerEmail || req.user?.email;
    const customerPhone = req.body.customerPhone;

    const order = new Order({
      orderItems,
      user: req.user?._id,
      customerEmail,
      customerPhone,
      shippingAddress,
      paymentMethod,
      itemsPrice: calculatedItemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    const createdOrder = await order.save();

    // Bug #14: Decrement stock for each ordered item
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.qty } });
    }

    res.status(201).json(createdOrder);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ user: req.user?._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Get order by ID (own order or admin)
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    // Bug #91: Admin can view any order; regular users can only view their own
    const isOwner = order.user.toString() === req.user?._id?.toString();
    const isAdminUser = (req.user as any)?.isAdmin === true;
    if (!isOwner && !isAdminUser) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    let queryArgs: any = {};

    if (status && typeof status === 'string') {
      queryArgs.status = status;
    }

    // Bug #77: Add pagination support
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const orders = await Order.find(queryArgs)
      .populate('user', 'id firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(queryArgs);

    res.json({
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
export const updateOrderToDelivered = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      // Bug #95: Also sync status field when marking delivered
      order.isDelivered = true;
      order.deliveredAt = new Date();
      order.status = 'Delivered';

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// Valid order status values
const VALID_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    // Bug #7: Validate status against allowed enum values
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const order = await Order.findById(req.params.id);

    if (order) {
      // Bug #18: Prevent changing status of already-delivered orders
      if (order.status === 'Delivered' && status !== 'Delivered') {
        res.status(400).json({ message: 'Cannot change status of a delivered order' });
        return;
      }

      order.status = status;

      // Bug #95: Keep isDelivered boolean in sync with status
      if (status === 'Delivered') {
        order.isDelivered = true;
        if (!order.deliveredAt) order.deliveredAt = new Date();
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Mark order as paid
// @route   PUT /api/orders/:id/pay
// @access  Private/Admin
export const markOrderAsPaid = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isPaid = true;
      order.paidAt = new Date();
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private (owner or admin)
export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Check if user is owner or admin
    const isOwner = order.user.toString() === req.user?._id?.toString();
    const isAdminUser = (req.user as any)?.isAdmin;

    if (!isOwner && !isAdminUser) {
      res.status(403).json({ message: 'Not authorized to cancel this order' });
      return;
    }

    // Bug #18: Already-delivered orders cannot be cancelled
    if (order.status === 'Delivered' || order.isDelivered) {
      res.status(400).json({ message: 'Cannot cancel an order that has already been delivered' });
      return;
    }

    if (order.status === 'Cancelled') {
      res.status(400).json({ message: 'Order is already cancelled' });
      return;
    }

    order.status = 'Cancelled';
    const updatedOrder = await order.save();

    // Bug #15: Restore stock when order is cancelled
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.qty } });
    }

    res.json(updatedOrder);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};
