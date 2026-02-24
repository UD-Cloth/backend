import { Response } from 'express';
import Review from '../models/Review';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get reviews for a product
// @route   GET /api/products/:id/reviews
// @access  Public
export const getProductReviews = async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await Review.find({ product: req.params.id })
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
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
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ message: 'Rating must be between 1 and 5' });
      return;
    }
    if (!comment?.trim()) {
      res.status(400).json({ message: 'Comment is required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const existing = await Review.findOne({ user: userId, product: productId });
    if (existing) {
      res.status(400).json({ message: 'You have already reviewed this product' });
      return;
    }

    const review = await Review.create({
      user: userId,
      product: productId,
      rating: Number(rating),
      comment: comment.trim(),
    });

    const reviews = await Review.find({ product: productId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    product.rating = Math.round(avgRating * 10) / 10;
    product.reviewCount = reviews.length;
    await product.save();

    const populated = await Review.findById(review._id).populate('user', 'firstName lastName');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
