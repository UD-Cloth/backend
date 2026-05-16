import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';

// Simple helper to strip HTML tags preventing basic stored XSS
const sanitizeHTML = (str: string) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '');
};

// @desc    Fetch all products with optional filters
// @route   GET /api/products
// @access  Public
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category, isTrending, isNew, isSale, isFeatured, q, page = '1', limit = '20' } = req.query;
    // Bug #16: Only return active products to the public API
    let queryArgs: any = { status: 'active' };

    if (category) {
      const cat = await Category.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } });
      if (cat) queryArgs.category = cat._id;
    }

    if (isTrending === 'true') queryArgs.isTrending = true;
    if (isNew === 'true') queryArgs.isNewItem = true;
    if (isFeatured === 'true') queryArgs.isFeatured = true;

    if (isSale === 'true') {
      queryArgs.$expr = { $gt: ['$originalPrice', '$price'] };
    }

    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      // Bug #97/#98: Also search brand, tags, and category names
      const matchingCategories = await Category.find({ name: searchRegex }).select('_id');
      const categoryIds = matchingCategories.map((c) => c._id);
      queryArgs.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { sku: searchRegex },
        { tags: searchRegex },
        ...(categoryIds.length > 0 ? [{ category: { $in: categoryIds } }] : []),
      ];
    }

    // Bug #76: Add pagination support
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Bug #142: .lean() — read-only listing skips Mongoose hydration, ~3-5x faster.
    const products = await Product.find(queryArgs)
      .populate('category', 'name')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Product.countDocuments(queryArgs);

    res.json({
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    // Bug #138/#139: Return 400 for invalid IDs, 500 for real server errors
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (product) {
      const Review = require('../models/Review').default;
      // Bug #121: Limit embedded reviews to ~20 most recent. Clients that need
      // more should use the paginated /api/reviews endpoint with `?productId=`.
      const reviewsLimit = Math.min(50, Math.max(1, parseInt(String(req.query.reviewsLimit ?? '20'), 10) || 20));
      const reviews = await Review.find({ product: product._id })
        .populate('user', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(reviewsLimit);
      const reviewsTotal = await Review.countDocuments({ product: product._id });

      const productObj = product.toObject() as any;
      productObj.reviews = reviews;
      productObj.reviewsTotal = reviewsTotal;
      res.json(productObj);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error: any) {
    // Bug #138/#139: Return 400 for invalid IDs, 500 for real server errors
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

// @desc    Fast search endpoint for header products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    if (!q || typeof q !== 'string') {
      res.json([]);
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) {
      res.json([]);
      return;
    }
    const cap = Math.min(50, Math.max(1, Number(limit) || 5));

    // Sprint 7 / BUG-B-038: use the `text` index added in Sprint 3 (covers
    // name, description, tags). Falls back to a regex pass when `$text` returns
    // nothing — single-character queries don't match the text index, and we
    // still want to find SKUs/brand prefixes the index doesn't cover.
    let products: any[] = [];
    if (trimmed.length >= 2) {
      products = await Product.find(
        { status: 'active', $text: { $search: trimmed } },
        { score: { $meta: 'textScore' } }
      )
        .select('name price image category brand sku')
        .populate('category', 'name')
        .sort({ score: { $meta: 'textScore' } })
        .limit(cap);
    }

    if (products.length === 0) {
      const safeRegex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingCats = await Category.find({ name: safeRegex }).select('_id');
      const matchCatIds = matchingCats.map((c) => c._id);
      products = await Product.find({
        status: 'active',
        $or: [
          { name: safeRegex },
          { brand: safeRegex },
          { sku: safeRegex },
          { tags: safeRegex },
          ...(matchCatIds.length > 0 ? [{ category: { $in: matchCatIds } }] : []),
        ],
      })
        .select('name price image category brand sku')
        .populate('category', 'name')
        .limit(cap);
    }

    res.json(products);
  } catch (error: any) {
    // Bug #138/#139: Return 400 for invalid IDs, 500 for real server errors
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, price, originalPrice, description, image, images, category, sizes, colors, fabric, isNewItem, isTrending, brand, sku, stock, tags, status, isFeatured, isNewArrival } = req.body;

    // Bug #104: Require non-empty name and description
    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Product name is required' });
      return;
    }
    if (!description || !description.trim()) {
      res.status(400).json({ message: 'Product description is required' });
      return;
    }

    // Sprint 5 / BUG-B-049: validate category is a real ObjectId pointing to an
    // existing Category, and that price/originalPrice make sense.
    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      res.status(400).json({ message: 'A valid category is required' });
      return;
    }
    const categoryExists = await Category.exists({ _id: category });
    if (!categoryExists) {
      res.status(400).json({ message: 'Category not found' });
      return;
    }
    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      res.status(400).json({ message: 'Price must be a non-negative number' });
      return;
    }
    if (originalPrice !== undefined) {
      const numOrig = Number(originalPrice);
      if (!Number.isFinite(numOrig) || numOrig < numPrice) {
        res.status(400).json({ message: 'originalPrice must be ≥ price' });
        return;
      }
    }

    const product = new Product({
      name: sanitizeHTML(name.trim()),
      price: numPrice,
      originalPrice: originalPrice,
      description: sanitizeHTML(description.trim()),
      image: image || '/images/sample.jpg',
      images: images || [],
      category: category || undefined,
      sizes: sizes || [],
      colors: colors || [],
      fabric: fabric || 'Sample fabric',
      isNewItem: isNewItem ?? false,
      isTrending: isTrending ?? false,
      brand: brand || undefined,
      sku: sku || undefined,
      stock: stock ?? 0,
      tags: tags || [],
      status: status || 'active',
      isFeatured: isFeatured ?? false,
      isNewArrival: isNewArrival ?? false
    });

    try {
      const createdProduct = await product.save();
      res.status(201).json(createdProduct);
    } catch (err: any) {
      // Sprint 5 / BUG-B-050: surface duplicate SKU as a clean 409.
      if (err?.code === 11000) {
        res.status(409).json({ message: 'A product with this SKU already exists', keyValue: err.keyValue });
        return;
      }
      throw err;
    }
  } catch (error: any) {
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    if (error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { name, price, originalPrice, description, image, images, category, sizes, colors, fabric, isNewItem, isTrending, brand, sku, stock, tags, status, isFeatured, isNewArrival } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      // Bug #188: Optimistic concurrency — if the client sends `expectedVersion`
      // (the `__v` from the doc they loaded), reject with 409 when another
      // admin has saved in between. Clients that don't send it keep working
      // with last-write-wins, so this is opt-in and back-compatible.
      const expectedVersion = req.body.expectedVersion;
      if (
        expectedVersion !== undefined &&
        Number.isFinite(Number(expectedVersion)) &&
        Number(expectedVersion) !== (product as any).__v
      ) {
        res.status(409).json({
          message: 'This product was modified by someone else. Reload and try again.',
          currentVersion: (product as any).__v,
        });
        return;
      }

      // Sprint 7 / BUG-B-052: validate status enum at the controller layer so
      // bad input returns 400 with a clear message instead of bubbling to a
      // generic 500.
      if (status !== undefined && status !== 'active' && status !== 'inactive') {
        res.status(400).json({ message: "Status must be 'active' or 'inactive'" });
        return;
      }
      if (price !== undefined) {
        const numPrice = Number(price);
        if (!Number.isFinite(numPrice) || numPrice < 0) {
          res.status(400).json({ message: 'Price must be a non-negative number' });
          return;
        }
        product.price = numPrice;
      }
      if (originalPrice !== undefined) {
        const numOrig = Number(originalPrice);
        if (!Number.isFinite(numOrig) || numOrig < (price ?? product.price)) {
          res.status(400).json({ message: 'originalPrice must be ≥ price' });
          return;
        }
        product.originalPrice = numOrig;
      }
      if (name !== undefined) product.name = sanitizeHTML(name);
      if (description !== undefined) product.description = sanitizeHTML(description);
      if (image !== undefined) product.image = image;
      if (images) product.images = images;
      if (category) product.category = category;
      if (sizes) product.sizes = sizes;
      if (colors) product.colors = colors;
      if (fabric !== undefined) product.fabric = fabric;
      if (isNewItem !== undefined) product.isNewItem = isNewItem;
      if (isTrending !== undefined) product.isTrending = isTrending;
      if (brand !== undefined) product.brand = brand;
      if (sku !== undefined) product.sku = sku;
      if (stock !== undefined) product.stock = stock;
      if (tags) product.tags = tags;
      if (status !== undefined) product.status = status;
      if (isFeatured !== undefined) product.isFeatured = isFeatured;
      if (isNewArrival !== undefined) product.isNewArrival = isNewArrival;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error: any) {
    // Bug #138/#139: Return 400 for invalid IDs, 500 for real server errors
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

// @desc    Delete a product (soft-delete: marks inactive and removes orphan reviews)
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      // Bug #86/#87: Soft-delete to avoid breaking active carts/wishlists
      // Mark as inactive so it won't be served to public API
      product.status = 'inactive';
      await product.save();

      // Bug #85: Clean up orphan review records when product is removed
      const Review = require('../models/Review').default;
      await Review.deleteMany({ product: product._id });

      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error: any) {
    // Bug #138/#139: Return 400 for invalid IDs, 500 for real server errors
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};
