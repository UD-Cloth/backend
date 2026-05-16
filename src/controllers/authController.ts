import { Request, Response } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import generateToken from '../utils/generateToken';
import { sendEmail } from '../utils/sendEmail';
import mongoose from 'mongoose';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const isProd = process.env.NODE_ENV === 'production';

// Sprint 1 / BUG-B-055: Hash reset / verification tokens before storing them in DB.
// We give the user the raw token in the email link; we only ever store sha256(token).
// Anyone with read-only DB access then cannot replay tokens.
const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

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

    // Bug #109: Account lockout — reject if currently locked.
    if (user && user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ message: `Account locked due to too many failed attempts. Try again in ${minutes} minute(s).` });
      return;
    }

    // Bug #131: Treat soft-deleted users as not found.
    if (user && (user as any).isDeleted) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (user && (await user.matchPassword(password))) {
      // Bug #1: Check if user is blocked before allowing login
      if (user.isBlocked) {
        res.status(401).json({ message: 'Your account has been blocked. Please contact support.' });
        return;
      }
      // Bug #109: reset lockout counters on successful login.
      if ((user.loginAttempts ?? 0) > 0 || user.lockUntil) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
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
      // Bug #109: increment failed attempts; lock for 30 min after 5 failures.
      if (user) {
        user.loginAttempts = (user.loginAttempts ?? 0) + 1;
        if (user.loginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
          user.loginAttempts = 0; // reset counter once locked
        }
        await user.save();
      }
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

// Sprint 5 / BUG-B-017: explicit allow-list of fields a user may change on
// their own profile. Anything else (isAdmin, isBlocked, wishlist, email,
// emailVerified, passwordResetToken, etc.) is silently ignored. Belt-and-braces
// against future contributors copy-pasting `Object.assign(user, req.body)`.
const PROFILE_FIELD_LIMITS: Record<string, number> = {
  firstName: 100,
  lastName: 100,
  phone: 20,
  address: 500,
  city: 100,
  state: 100,
  postalCode: 20,
};

const normalizeProfileField = (raw: any, max: number): string | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null) return '';
  if (typeof raw !== 'string') return undefined; // silently ignore non-string
  const trimmed = raw.trim();
  if (trimmed.length > max) return trimmed.slice(0, max);
  return trimmed;
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (user) {
      const fName = normalizeProfileField(req.body.firstName, PROFILE_FIELD_LIMITS.firstName);
      if (fName !== undefined) user.firstName = fName || user.firstName; // never blank
      const lName = normalizeProfileField(req.body.lastName, PROFILE_FIELD_LIMITS.lastName);
      if (lName !== undefined) user.lastName = lName || user.lastName;

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
        if (typeof req.body.newPassword !== 'string' || req.body.newPassword.length < 8) {
          res.status(400).json({ message: 'New password must be at least 8 characters long' });
          return;
        }
        user.password = req.body.newPassword;
      }

      const phone = normalizeProfileField(req.body.phone, PROFILE_FIELD_LIMITS.phone);
      if (phone !== undefined) user.phone = phone;
      const address = normalizeProfileField(req.body.address, PROFILE_FIELD_LIMITS.address);
      if (address !== undefined) user.address = address;
      const city = normalizeProfileField(req.body.city, PROFILE_FIELD_LIMITS.city);
      if (city !== undefined) user.city = city;
      const state = normalizeProfileField(req.body.state, PROFILE_FIELD_LIMITS.state);
      if (state !== undefined) user.state = state;
      const postalCode = normalizeProfileField(req.body.postalCode, PROFILE_FIELD_LIMITS.postalCode);
      if (postalCode !== undefined) user.postalCode = postalCode;

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
        // Sprint 7 / BUG-B-018: verify product exists and cap wishlist size.
        // Without this a malicious client could push thousands of fake ObjectIds
        // (still valid 24-hex) and bloat the User doc toward Mongo's 16 MB cap.
        const Product = (await import('../models/Product')).default;
        const exists = await Product.exists({ _id: productId });
        if (!exists) {
          res.status(404).json({ message: 'Product not found' });
          return;
        }
        const MAX_WISHLIST = 200;
        if (user.wishlist.length >= MAX_WISHLIST) {
          res.status(400).json({ message: `Wishlist is full (max ${MAX_WISHLIST} items). Remove an item to add a new one.` });
          return;
        }
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

// @desc    Resend email verification token
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' });
      return;
    }

    // Sprint 4 / BUG-B-032: do not leak whether an email is registered.
    // Always return the same generic success message regardless of branch.
    const GENERIC_RESPONSE = { message: 'If an account exists for that email, a verification link has been sent.' };

    const user = await User.findOne({ email });
    if (!user || user.emailVerified) {
      res.json(GENERIC_RESPONSE);
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${FRONTEND_URL}/auth/verify-email-pending?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify your URBAN DRAPE email',
      html: `<p>Hi ${user.firstName},</p>
        <p>Click the link below to verify your email. This link expires in 1 hour.</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    // Sprint 4 / BUG-B-030: never echo the raw token in the JSON response.
    // The previous `...(isProd ? {} : { token })` shipped reset/verify tokens
    // in network logs on every non-prod deploy.
    res.json(GENERIC_RESPONSE);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Verify email with token
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ message: 'Verification token is required' });
      return;
    }

    const user = await User.findOne({
      emailVerificationToken: hashToken(token),
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired verification token' });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Forgot password - generate reset token
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' });
      return;
    }

    // Sprint 4 / BUG-B-031: identical message regardless of whether email exists
    // OR SMTP is configured — prevents email enumeration.
    const GENERIC_RESPONSE = { message: 'If an account exists for that email, a password reset link has been sent.' };

    const user = await User.findOne({ email });
    if (!user) {
      res.json(GENERIC_RESPONSE);
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your URBAN DRAPE password',
      html: `<p>Hi ${user.firstName},</p>
        <p>Click the link below to reset your password. This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    // Sprint 4 / BUG-B-030: never echo the raw token in the JSON response.
    res.json(GENERIC_RESPONSE);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) {
      res.status(400).json({ message: 'Reset token is required' });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters long' });
      return;
    }

    const user = await User.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};
