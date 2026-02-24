import { Request, Response } from 'express';
import Product from '../models/Product';
import Category from '../models/Category';

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
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
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
      name: name || 'Sample name',
      price: price ?? 0,
      originalPrice: originalPrice,
      description: description || 'Sample description',
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
      product.name = name || product.name;
      product.price = price || product.price;
      if (originalPrice !== undefined) product.originalPrice = originalPrice;
      product.description = description || product.description;
      product.image = image || product.image;
      if (images) product.images = images;
      if (category) product.category = category;
      if (sizes) product.sizes = sizes;
      if (colors) product.colors = colors;
      product.fabric = fabric || product.fabric;
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
