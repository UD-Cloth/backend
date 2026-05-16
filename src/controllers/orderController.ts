import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Product from '../models/Product';
import Promotion from '../models/Promotion';
import Settings from '../models/Settings';
import { AuthRequest } from '../middleware/authMiddleware';
import { decrementUsage } from './promotionController';
// Bug #168: shared status enum (single source of truth)
import { ORDER_STATUSES } from '../constants/orderStatus';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const addOrderItems = async (req: AuthRequest, res: Response) => {
  // Sprint 1 / BUG-B-012: orderRoutes now uses `protect`, not `optionalAuth`,
  // so req.user is guaranteed. Belt-and-braces check here too.
  if (!req.user?._id) {
    res.status(401).json({ message: 'Authentication required to place an order' });
    return;
  }

  // Track which products we successfully decremented so we can refund on failure.
  const decremented: { product: string; qty: number }[] = [];

  try {
    const { orderItems, shippingAddress, paymentMethod } = req.body;

    if (!orderItems || orderItems.length === 0) {
      res.status(400).json({ message: 'No order items' });
      return;
    }

    // Sprint 1 / BUG-B-014: Decrement stock atomically with a guard so two
    // concurrent orders cannot both pass the stock check and oversell.
    let calculatedItemsPrice = 0;
    const productLookup = new Map<string, any>();

    for (const item of orderItems) {
      if (!mongoose.Types.ObjectId.isValid(item.product)) {
        res.status(400).json({ message: `Invalid product ID: ${item.product}` });
        return;
      }
      const qty = Math.max(1, Math.floor(Number(item.qty) || 0));
      if (qty < 1) {
        res.status(400).json({ message: 'Order item quantity must be ≥ 1' });
        return;
      }

      // Atomic compare-and-decrement: only succeeds if active AND stock ≥ qty.
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.product,
          status: { $ne: 'inactive' },
          $or: [{ stock: { $exists: false } }, { stock: { $gte: qty } }],
        },
        { $inc: { stock: -qty } },
        { returnDocument: 'after' }
      );

      if (!updated) {
        // Roll back any previous decrements before bailing.
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.qty } });
        }
        const probe = await Product.findById(item.product).select('name stock status');
        if (!probe) {
          res.status(404).json({ message: `Product not found: ${item.product}` });
        } else if (probe.status === 'inactive') {
          res.status(400).json({ message: `Product "${probe.name}" is no longer available` });
        } else {
          res.status(400).json({
            message: `Insufficient stock for "${probe.name}". Available: ${probe.stock ?? 0}`,
          });
        }
        return;
      }

      decremented.push({ product: String(item.product), qty });
      productLookup.set(String(item.product), updated);

      // Sprint 1 / BUG-B-016: Use the server price, ignore client-supplied prices.
      item.price = updated.price;
      item.qty = qty;
      calculatedItemsPrice += updated.price * qty;
    }

    // Sprint 4 / BUG-B-027 + BUG-F-014: read tax / shipping config from the
    // Settings model instead of hard-coding. Settings page changes now
    // actually affect orders. Falls back to historical defaults if missing.
    const settings = await Settings.findOne({}).lean();
    const taxPercentage = Number(settings?.taxPercentage ?? 10);
    const flatShippingRate = Number(settings?.flatShippingRate ?? 150);
    const freeShippingThreshold = Number(settings?.freeShippingThreshold ?? 2000);

    const taxPrice = Math.round(calculatedItemsPrice * (taxPercentage / 100) * 100) / 100;
    const shippingPrice = calculatedItemsPrice >= freeShippingThreshold ? 0 : flatShippingRate;
    const subtotalWithTaxShip = calculatedItemsPrice + taxPrice + shippingPrice;

    // Sprint 1 / BUG-B-016 + Sprint 4 / BUG-B-006:
    // Atomically claim a promotion redemption when validating, so two
    // concurrent orders cannot both pass the usage-cap check.
    let couponCode: string | undefined;
    let discountAmount = 0;
    let promoClaimed = false;
    const rawCoupon = req.body.couponCode?.toString().trim().toUpperCase();
    if (rawCoupon) {
      const now = new Date();
      // Conditions:
      //   - exists, active
      //   - not expired
      //   - usageLimit unset OR usageCount < usageLimit
      // We $inc usageCount only when all conditions hold. If `null` is returned,
      // either the code doesn't exist or all conditions failed → reject.
      const promo = await Promotion.findOneAndUpdate(
        {
          code: rawCoupon,
          isActive: true,
          $or: [{ expiryDate: { $exists: false } }, { expiryDate: null }, { expiryDate: { $gte: now } }],
          $and: [
            {
              $or: [
                { usageLimit: { $exists: false } },
                { usageLimit: null },
                { $expr: { $lt: ['$usageCount', '$usageLimit'] } },
              ],
            },
          ],
        },
        { $inc: { usageCount: 1 } },
        { returnDocument: 'after' }
      );

      if (!promo || (promo.minPurchaseAmount !== undefined && calculatedItemsPrice < promo.minPurchaseAmount)) {
        // If we already incremented but min-purchase failed, roll back.
        if (promo) {
          try { await decrementUsage(rawCoupon); } catch (_) { /* swallow */ }
        }
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.qty } });
        }
        res.status(400).json({
          message: 'Invalid, inactive, expired, used-up, or unmet-minimum promo code',
        });
        return;
      }

      promoClaimed = true;
      couponCode = promo.code;
      if (promo.type === 'percentage') {
        discountAmount = (subtotalWithTaxShip * promo.value) / 100;
      } else {
        discountAmount = promo.value;
      }
      if (discountAmount > subtotalWithTaxShip) discountAmount = subtotalWithTaxShip;
      discountAmount = Math.round(discountAmount * 100) / 100;
    }

    const finalTotal = Math.max(0, subtotalWithTaxShip - discountAmount);

    const customerEmail = req.body.customerEmail || req.user?.email;
    const customerPhone = req.body.customerPhone;

    const order = new Order({
      orderItems,
      user: req.user._id,
      customerEmail,
      customerPhone,
      shippingAddress,
      paymentMethod,
      itemsPrice: calculatedItemsPrice,
      taxPrice,
      shippingPrice,
      couponCode,
      discountAmount,
      totalPrice: finalTotal,
    });

    let createdOrder;
    try {
      createdOrder = await order.save();
    } catch (saveErr) {
      // If the save itself fails, refund the promotion redemption we just claimed.
      if (promoClaimed && couponCode) {
        try { await decrementUsage(couponCode); } catch (_) { /* swallow */ }
      }
      throw saveErr;
    }

    res.status(201).json(createdOrder);
  } catch (error: any) {
    // Roll back any partial stock decrement on unexpected failure.
    for (const d of decremented) {
      try {
        await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.qty } });
      } catch (_) {
        /* swallow — already in error path */
      }
    }
    const castErr = error as any;
    if (castErr.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    // Sprint 6 / BUG-B-054: support pagination so a customer with many orders
    // doesn't OOM the page on first load. `limit` is clamped, default kept
    // generous (50) so existing UIs that don't paginate still get most data.
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user?._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments({ user: req.user?._id }),
    ]);

    // If no pagination query params were passed, preserve the legacy "bare array"
    // shape so existing frontend hooks keep working without a coordinated change.
    const wantsPaginated = req.query.page !== undefined || req.query.limit !== undefined;
    if (wantsPaginated) {
      res.json({ data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } else {
      res.json(orders);
    }
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
    const { status, page = '1', limit = '20', q } = req.query;
    const queryArgs: any = {};

    if (status && typeof status === 'string') {
      queryArgs.status = status;
    }

    // Sprint 6 / BUG-B-039: optional admin search across order id, customer
    // email, and customer phone. Order id matches a tail-of-id prefix so admins
    // can paste the short ID shown in the UI (`#A1B2C3D4`).
    if (q && typeof q === 'string' && q.trim()) {
      const term = q.trim();
      const safeRe = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const or: any[] = [{ customerEmail: safeRe }, { customerPhone: safeRe }];
      // Try matching as ObjectId if it parses; otherwise just the regex paths.
      if (/^[a-f0-9]{24}$/i.test(term)) {
        or.push({ _id: term });
      }
      queryArgs.$or = or;
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const orders = await Order.find(queryArgs)
      // Bug #141: include email so the admin orders table can render contact
      // info without N+1 follow-up fetches per row.
      .populate('user', 'id firstName lastName email')
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
        pages: Math.ceil(total / limitNum),
      },
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

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    // Sprint 5 / BUG-B-040: idempotent — already delivered? bail with 400.
    if (order.isDelivered || order.status === 'Delivered') {
      res.status(400).json({ message: 'Order is already marked as delivered' });
      return;
    }
    if (order.status === 'Cancelled') {
      res.status(400).json({ message: 'Cannot deliver a cancelled order' });
      return;
    }

    order.isDelivered = true;
    order.deliveredAt = new Date();
    order.status = 'Delivered';

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// Bug #168: VALID_STATUSES sourced from `../constants/orderStatus` (imported above).
const VALID_STATUSES = ORDER_STATUSES;

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
      // Sprint 5 / BUG-B-041: terminal-state lock. Once an order is Delivered
      // or Cancelled, the only allowed "transition" is to itself (idempotent).
      // Without this, an admin could un-cancel an already-restocked order and
      // double-count stock, or revert delivery and fake un-fulfilment.
      const isTerminal = order.status === 'Delivered' || order.status === 'Cancelled';
      if (isTerminal && status !== order.status) {
        res.status(400).json({ message: `Cannot change status of a ${order.status?.toLowerCase()} order` });
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

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    // Sprint 5 / BUG-B-040: idempotent — already paid? bail with 400 instead
    // of overwriting `paidAt` and confusing reconciliation.
    if (order.isPaid) {
      res.status(400).json({ message: 'Order is already marked as paid' });
      return;
    }
    if (order.status === 'Cancelled') {
      res.status(400).json({ message: 'Cannot mark a cancelled order as paid' });
      return;
    }
    order.isPaid = true;
    order.paidAt = new Date();
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private (owner or admin)
export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    // Sprint 4 / BUG-B-015: Atomically flip the order to Cancelled.
    // Two concurrent cancel requests previously both passed the read-then-write
    // gate, both restocked, doubling stock. findOneAndUpdate guarantees only one
    // request actually transitions the doc.
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const isOwner = order.user.toString() === req.user?._id?.toString();
    const isAdminUser = (req.user as any)?.isAdmin;

    if (!isOwner && !isAdminUser) {
      res.status(403).json({ message: 'Not authorized to cancel this order' });
      return;
    }

    if (order.status === 'Delivered' || order.isDelivered) {
      res.status(400).json({ message: 'Cannot cancel an order that has already been delivered' });
      return;
    }

    if (order.status === 'Cancelled') {
      res.status(400).json({ message: 'Order is already cancelled' });
      return;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: { $nin: ['Cancelled', 'Delivered'] } },
      { status: 'Cancelled' },
      { returnDocument: 'after' }
    );

    if (!updatedOrder) {
      // Lost the race — somebody else already moved it out of cancellable state.
      res.status(409).json({ message: 'Order is no longer cancellable' });
      return;
    }

    // Restore stock for each item.
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.qty } });
    }

    // Sprint 4 / BUG-B-014: refund the promotion redemption when an order is cancelled.
    if (order.couponCode) {
      try {
        await decrementUsage(order.couponCode);
      } catch (e) {
        console.error('[promo] decrementUsage on cancel failed', e);
      }
    }

    res.json(updatedOrder);
  } catch (error: any) {
    const castErr = (error as any); if (castErr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castErr.message || 'Server Error' });
  }
};
