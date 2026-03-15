import { Request, Response } from 'express';
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
        { tags: searchRegex },
        ...(categoryIds.length > 0 ? [{ category: { $in: categoryIds } }] : []),
      ];
    }

    // Bug #76: Add pagination support
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(queryArgs)
      .populate('category', 'name')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

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
      const reviews = await Review.find({ product: product._id })
        .populate('user', 'firstName lastName')
        .sort({ createdAt: -1 });

      const productObj = product.toObject() as any;
      productObj.reviews = reviews;
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
    const searchRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Bug #16: Only return active products
    // Bug #97/#98: Also search brand, tags, and category names
    const matchingCats = await Category.find({ name: searchRegex }).select('_id');
    const matchCatIds = matchingCats.map((c) => c._id);
    const products = await Product.find({
      status: 'active',
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { tags: searchRegex },
        ...(matchCatIds.length > 0 ? [{ category: { $in: matchCatIds } }] : []),
      ]
    })
      .select('name price image category')
      .populate('category', 'name')
      .limit(Number(limit) || 5);

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

    const product = new Product({
      name: sanitizeHTML(name.trim()),
      price: price ?? 0,
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

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error: any) {
    // Bug #138/#139: Return 400 for invalid IDs, 500 for real server errors
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
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
      if (name !== undefined) product.name = sanitizeHTML(name);
      if (price !== undefined) product.price = price;
      if (originalPrice !== undefined) product.originalPrice = originalPrice;
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
