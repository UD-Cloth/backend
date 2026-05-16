import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';

const UNCATEGORIZED = 'Uncategorized';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, image } = req.body;
    // Bug #126: Reject empty / whitespace-only category names.
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Category name is required' });
      return;
    }
    const category = new Category({ name: name.trim(), image });
    const createdCategory = await category.save();
    // Bug #133: 201 already returned on create.
    res.status(201).json(createdCategory);
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ message: 'A category with this name already exists' });
      return;
    }
    if (error?.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { name, image } = req.body;
    const category = await Category.findById(req.params.id);

    if (category) {
      category.name = name || category.name;
      category.image = image || category.image;

      const updatedCategory = await category.save();
      res.json(updatedCategory);
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    // Bug #197: Before deleting, reassign any products that referenced this
    // category to "Uncategorized" so they remain visible/searchable instead
    // of rendering as `Category: undefined` on the storefront.
    const reassigned = await Product.updateMany(
      { category: category.name },
      { $set: { category: UNCATEGORIZED } }
    );

    await Category.deleteOne({ _id: category._id });
    res.json({
      message: 'Category removed',
      productsReassigned: reassigned.modifiedCount ?? 0,
    });
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};
