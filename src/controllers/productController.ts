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
    const { category, isTrending, isNew, isSale, q } = req.query;
    let queryArgs: any = {};

    if (category) {
      const cat = await Category.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } });
      if (cat) queryArgs.category = cat._id;
    }

    if (isTrending === 'true') queryArgs.isTrending = true;
    if (isNew === 'true') queryArgs.isNewItem = true;

    if (isSale === 'true') {
      queryArgs.$expr = { $gt: ['$originalPrice', '$price'] };
    }

    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      queryArgs.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
    }

    const products = await Product.find(queryArgs).populate('category', 'name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
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
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
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

    // Only return the fields necessary for suggestions
    const products = await Product.find({
      $or: [{ name: searchRegex }, { description: searchRegex }]
    })
      .select('name price image category')
      .populate('category', 'name')
      .limit(Number(limit) || 5);

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, price, originalPrice, description, image, images, category, sizes, colors, fabric, isNewItem, isTrending } = req.body;

    const product = new Product({
      name: name ? sanitizeHTML(name) : 'Sample name',
      price: price ?? 0,
      originalPrice: originalPrice,
      description: description ? sanitizeHTML(description) : 'Sample description',
      image: image || '/images/sample.jpg',
      images: images || [],
      category: category || undefined,
      sizes: sizes || [],
      colors: colors || [],
      fabric: fabric || 'Sample fabric',
      isNewItem: isNewItem ?? false,
      isTrending: isTrending ?? false
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { name, price, originalPrice, description, image, images, category, sizes, colors, fabric, isNewItem, isTrending } = req.body;

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

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      await Product.deleteOne({ _id: product._id });
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
