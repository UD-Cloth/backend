import { Request, Response } from 'express';
import User from '../models/User';
import generateToken from '../utils/generateToken';
import mongoose from 'mongoose';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Bug #103: Validate email format on backend
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' });
      return;
    }

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // Bug #1: Check if user is blocked before allowing login
      if (user.isBlocked) {
        res.status(401).json({ message: 'Your account has been blocked. Please contact support.' });
        return;
      }
      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    // Bug #103: Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' });
      return;
    }

    // Bug #6: Enforce minimum password strength
    if (!password || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters long' });
      return;
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (user) {
      // Bug #89: Return only safe fields, exclude isBlocked, password, etc.
      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        state: user.state,
        postalCode: user.postalCode,
        isAdmin: user.isAdmin,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Get user dashboard (profile + orders)
// @route   GET /api/auth/dashboard
// @access  Private
export const getUserDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (user) {
      // Bug #75: Use static import instead of require() inside function
      const Order = (await import('../models/Order')).default;
      const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
      res.json({
        profile: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          address: user.address,
          city: user.city,
          state: user.state,
          postalCode: user.postalCode,
          isAdmin: user.isAdmin,
        },
        orders: orders
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (user) {
      user.firstName = req.body.firstName || user.firstName;
      user.lastName = req.body.lastName || user.lastName;
      // Bug #27: Require current password to update password
      if (req.body.newPassword) {
        if (!req.body.currentPassword) {
          res.status(400).json({ message: 'Current password is required to set a new password' });
          return;
        }
        const isMatch = await user.matchPassword(req.body.currentPassword);
        if (!isMatch) {
          res.status(400).json({ message: 'Current password is incorrect' });
          return;
        }
        // Bug #6: Enforce password strength on update
        if (req.body.newPassword.length < 8) {
          res.status(400).json({ message: 'New password must be at least 8 characters long' });
          return;
        }
        user.password = req.body.newPassword;
      }
      user.phone = req.body.phone ?? user.phone;
      user.address = req.body.address ?? user.address;
      user.city = req.body.city ?? user.city;
      user.state = req.body.state ?? user.state;
      user.postalCode = req.body.postalCode ?? user.postalCode;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        city: updatedUser.city,
        state: updatedUser.state,
        postalCode: updatedUser.postalCode,
        isAdmin: updatedUser.isAdmin,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Get user wishlist
// @route   GET /api/auth/wishlist
// @access  Private
export const getWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id).populate('wishlist');
    if (user) {
      res.json(user.wishlist);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Toggle item in wishlist
// @route   POST /api/auth/wishlist
// @access  Private
export const toggleWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.body;

    // Bug #139: Validate ObjectId to avoid CastError 500
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: 'Invalid product ID' });
      return;
    }

    const user = await User.findById(req.user?._id);

    if (user) {
      const alreadyInWishlist = user.wishlist.find(
        (id) => id.toString() === productId.toString()
      );

      if (alreadyInWishlist) {
        user.wishlist = user.wishlist.filter(
          (id) => id.toString() !== productId.toString()
        ) as any;
      } else {
        user.wishlist.push(productId);
      }

      await user.save();
      const populatedUser = await User.findById(req.user?._id).populate('wishlist');
      res.json(populatedUser?.wishlist);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};
