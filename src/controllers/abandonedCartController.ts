import { Request, Response } from 'express';
import AbandonedCart from '../models/AbandonedCart';

// Sprint 5 / BUG-B-022 + BUG-B-023:
// - Cap input lengths so an unauthenticated public endpoint can't blow up the DB.
// - Dedup by sessionId via upsert so each visitor produces one row, not dozens.
const MAX_ITEMS = 50;
const MAX_SESSION_ID = 64;
const MAX_EMAIL = 200;
const MAX_PAGE_PATH = 256;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const logAbandonedCart = async (req: Request, res: Response) => {
  try {
    const { sessionId, email, items, totalValue, checkoutStarted, pageAbandoned } = req.body;

    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > MAX_SESSION_ID) {
      res.status(400).json({ message: 'sessionId is required (max 64 chars)' });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'items must be a non-empty array' });
      return;
    }
    if (items.length > MAX_ITEMS) {
      res.status(400).json({ message: `items cannot exceed ${MAX_ITEMS}` });
      return;
    }
    if (email !== undefined && (typeof email !== 'string' || email.length > MAX_EMAIL || !EMAIL_RE.test(email))) {
      res.status(400).json({ message: 'Invalid email format' });
      return;
    }
    const safePage = typeof pageAbandoned === 'string' ? pageAbandoned.slice(0, MAX_PAGE_PATH) : '';

    // Per-item shape check + cap each item's strings.
    const safeItems = items.map((it: any) => ({
      productId: typeof it?.productId === 'string' ? it.productId.slice(0, 100) : '',
      name: typeof it?.name === 'string' ? it.name.slice(0, 200) : '',
      image: typeof it?.image === 'string' ? it.image.slice(0, 500) : '',
      price: Number(it?.price) || 0,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(it?.quantity) || 0))),
      size: typeof it?.size === 'string' ? it.size.slice(0, 20) : undefined,
      color: typeof it?.color === 'string' ? it.color.slice(0, 50) : undefined,
    }));

    const cart = await AbandonedCart.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        email,
        items: safeItems,
        totalValue: Math.max(0, Number(totalValue) || 0),
        checkoutStarted: Boolean(checkoutStarted),
        pageAbandoned: safePage,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    res.status(201).json(cart);
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    if (error?.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Sprint 5 / BUG-B-021: paginated admin list (cap 100/page).
export const getAbandonedCarts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      AbandonedCart.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AbandonedCart.countDocuments({}),
    ]);
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAbandonedCart = async (req: Request, res: Response) => {
  try {
    const cart = await AbandonedCart.findById(req.params.id);
    if (!cart) {
      res.status(404).json({ message: 'Abandoned cart not found' });
      return;
    }
    await AbandonedCart.deleteOne({ _id: cart._id });
    res.json({ message: 'Abandoned cart removed' });
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};
