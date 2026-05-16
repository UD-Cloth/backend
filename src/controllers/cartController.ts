import { Response } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/authMiddleware';

// Sprint 4 / BUG-B-003 + BUG-B-004 + BUG-B-005:
//   - Validate productId is a real ObjectId for an existing Product.
//   - Cap variantId length to prevent unbounded user strings as keys.
//   - Cap cart size and per-item quantity.
//   - Compute price server-side from the Product (client-supplied price ignored).
//   - Return 400 (not 500) on bad input.

const MAX_CART_ITEMS = 100;
const MAX_VARIANT_ID_LEN = 64;
const MAX_QUANTITY = 99;

const clampQty = (n: any) =>
  Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(n) || 0)));

const sanitizeVariantId = (raw: any): string | null => {
  if (typeof raw !== 'string') return null;
  if (!raw.trim()) return null;
  if (raw.length > MAX_VARIANT_ID_LEN) return null;
  return raw;
};

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    let cart = await Cart.findOne({ user: req.user?._id }).populate('items.productId');

    if (!cart) {
      cart = await Cart.create({ user: req.user?._id, items: [] });
    }

    // Sprint 4 / BUG-B-053: filter out items whose product is missing or inactive.
    // populate() will leave productId as `null` for deleted products; we shouldn't
    // ship those to the storefront where they'd render broken cards.
    cart.items = cart.items.filter((it: any) => {
      const p = it.productId as any;
      return p && p.status !== 'inactive';
    }) as any;

    res.json(cart);
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, variantTitle, selectedOptions } = req.body;
    const variantId = sanitizeVariantId(req.body.variantId);
    const quantity = clampQty(req.body.quantity);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: 'Invalid productId' });
      return;
    }
    if (!variantId) {
      res.status(400).json({ message: 'variantId is required (max 64 chars)' });
      return;
    }
    if (!variantTitle || typeof variantTitle !== 'string' || variantTitle.length > 200) {
      res.status(400).json({ message: 'variantTitle is required (max 200 chars)' });
      return;
    }

    // Server-side price lookup. Reject if product is missing or inactive.
    const product = await Product.findById(productId).select('price status');
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    if (product.status === 'inactive') {
      res.status(400).json({ message: 'This product is no longer available' });
      return;
    }

    let cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      cart = new Cart({ user: req.user?._id, items: [] });
    }

    const existItemIndex = cart.items.findIndex((item: any) => item.variantId === variantId);

    if (existItemIndex > -1) {
      const newQty = clampQty(cart.items[existItemIndex].quantity + quantity);
      cart.items[existItemIndex].quantity = newQty;
    } else {
      if (cart.items.length >= MAX_CART_ITEMS) {
        res.status(400).json({ message: `Cart cannot exceed ${MAX_CART_ITEMS} distinct items` });
        return;
      }
      cart.items.push({
        productId,
        variantId,
        variantTitle,
        // Cart schema stores price as { amount: string, currencyCode: string }.
        // We always derive amount from the live product, never from the client.
        price: { amount: String(product.price), currencyCode: 'INR' },
        quantity,
        selectedOptions: Array.isArray(selectedOptions) ? selectedOptions.slice(0, 10) : [],
      } as any);
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.productId');
    res.status(201).json(updatedCart);
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

// @desc    Update cart item quantity
// @route   PUT /api/cart/:variantId
// @access  Private
export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const variantId = sanitizeVariantId(req.params.variantId);
    if (!variantId) {
      res.status(400).json({ message: 'Invalid variantId' });
      return;
    }
    // Allow 0 to remove; cap upper bound.
    const rawQ = Number(req.body.quantity);
    if (Number.isNaN(rawQ)) {
      res.status(400).json({ message: 'Quantity must be a number' });
      return;
    }
    const quantity = rawQ <= 0 ? 0 : Math.min(MAX_QUANTITY, Math.floor(rawQ));

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex((item: any) => item.variantId === variantId);
    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }
    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.productId');
    res.json(updatedCart);
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:variantId
// @access  Private
export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const variantId = sanitizeVariantId(req.params.variantId);
    if (!variantId) {
      res.status(400).json({ message: 'Invalid variantId' });
      return;
    }
    const cart = await Cart.findOne({ user: req.user?._id });

    if (cart) {
      cart.items = cart.items.filter((item: any) => item.variantId !== variantId) as any;
      await cart.save();
      const updatedCart = await Cart.findById(cart._id).populate('items.productId');
      res.json(updatedCart);
    } else {
      res.status(404).json({ message: 'Cart not found' });
    }
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id });

    if (cart) {
      cart.items = [] as any;
      await cart.save();
      res.json({ message: 'Cart cleared' });
    } else {
      res.status(404).json({ message: 'Cart not found' });
    }
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
};
