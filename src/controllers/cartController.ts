import { Response } from 'express';
import Cart from '../models/Cart';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    let cart = await Cart.findOne({ user: req.user?._id }).populate('items.productId');

    if (!cart) {
      cart = await Cart.create({ user: req.user?._id, items: [] });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, variantId, variantTitle, price, quantity, selectedOptions } = req.body;

    let cart = await Cart.findOne({ user: req.user?._id });

    if (!cart) {
      cart = new Cart({ user: req.user?._id, items: [] });
    }

    const existItemIndex = cart.items.findIndex(item => item.variantId === variantId);

    if (existItemIndex > -1) {
      cart.items[existItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        productId,
        variantId,
        variantTitle,
        price,
        quantity,
        selectedOptions
      });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.productId');
    res.status(201).json(updatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:variantId
// @access  Private
export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const { variantId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user?._id });

    if (cart) {
      const itemIndex = cart.items.findIndex(item => item.variantId === variantId);

      if (itemIndex > -1) {
        if (quantity <= 0) {
          cart.items.splice(itemIndex, 1);
        } else {
          cart.items[itemIndex].quantity = quantity;
        }
        await cart.save();
        const updatedCart = await Cart.findById(cart._id).populate('items.productId');
        res.json(updatedCart);
      } else {
        res.status(404).json({ message: 'Item not found in cart' });
      }
    } else {
      res.status(404).json({ message: 'Cart not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:variantId
// @access  Private
export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const { variantId } = req.params;

    const cart = await Cart.findOne({ user: req.user?._id });

    if (cart) {
      cart.items = cart.items.filter(item => item.variantId !== variantId);
      await cart.save();
      const updatedCart = await Cart.findById(cart._id).populate('items.productId');
      res.json(updatedCart);
    } else {
      res.status(404).json({ message: 'Cart not found' });
    }
  } catch (error) {
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
      cart.items = [];
      await cart.save();
      res.json({ message: 'Cart cleared' });
    } else {
      res.status(404).json({ message: 'Cart not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
