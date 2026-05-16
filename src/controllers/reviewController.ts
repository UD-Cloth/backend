import { Request, Response } from 'express';
import Review from '../models/Review';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get reviews for a product
// @route   GET /api/products/:id/reviews
// @access  Public
export const getProductReviews = async (req: AuthRequest, res: Response) => {
  try {
    // Sprint 5 / BUG-B-020: cap with optional pagination so a 10k-review product
    // doesn't generate a multi-MB response on every page view.
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ product: req.params.id })
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json(reviews);
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add a review
// @route   POST /api/products/:id/reviews
// @access  Private
export const addReview = async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.params.id;
    const { rating, comment } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }
    // Sprint 5 / BUG-B-048: integer rating only.
    const ratingNum = Math.floor(Number(rating));
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
      return;
    }
    // Sprint 5 / BUG-B-047: cap comment length.
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    if (!trimmedComment) {
      res.status(400).json({ message: 'Comment is required' });
      return;
    }
    if (trimmedComment.length > 2000) {
      res.status(400).json({ message: 'Comment must be 2000 characters or less' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Check if the user has actually purchased this product
    const Order = require('../models/Order').default; // Using require to avoid top-level cyclic import if any, or just import it at top.
    const hasPurchased = await Order.findOne({
      user: userId,
      'orderItems.product': productId
    });

    if (!hasPurchased) {
      res.status(403).json({ message: 'You must purchase this product before reviewing it' });
      return;
    }

    const existing = await Review.findOne({ user: userId, product: productId });
    if (existing) {
      res.status(400).json({ message: 'You have already reviewed this product' });
      return;
    }

    let review;
    try {
      review = await Review.create({
        user: userId,
        product: productId,
        rating: ratingNum,
        comment: trimmedComment,
      });
    } catch (err: any) {
      // Sprint 5 / BUG-B-046: surface the unique-index race as a clean 409.
      if (err?.code === 11000) {
        res.status(409).json({ message: 'You have already reviewed this product' });
        return;
      }
      throw err;
    }

    const reviews = await Review.find({ product: productId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    product.rating = Math.round(avgRating * 10) / 10;
    product.reviewCount = reviews.length;
    await product.save();

    const populated = await Review.findById(review._id).populate('user', 'firstName lastName');
    res.status(201).json(populated);
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    if (error?.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all reviews (moderation)
// @route   GET /api/reviews
// @access  Private/Admin
export const getAllReviews = async (_req: Request, res: Response) => {
  try {
    const reviews = await Review.find({})
      .populate('user', 'firstName lastName email')
      .populate('product', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Delete a review (moderation)
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    const productId = review.product;
    await Review.deleteOne({ _id: review._id });

    const product = await Product.findById(productId);
    if (product) {
      const reviews = await Review.find({ product: productId });
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        product.rating = Math.round(avgRating * 10) / 10;
        product.reviewCount = reviews.length;
      } else {
        product.rating = 0;
        product.reviewCount = 0;
      }
      await product.save();
    }

    res.json({ message: 'Review removed' });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};
