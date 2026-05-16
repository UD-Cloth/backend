import { Request, Response } from 'express';
import User from '../models/User';
import Cart from '../models/Cart';
import Review from '../models/Review';
import AbandonedCart from '../models/AbandonedCart';
import Order from '../models/Order';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    // Bug #78: Add pagination support
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Bug #131: Hide soft-deleted users from the admin list.
    const baseQuery = { isDeleted: { $ne: true } } as any;
    const users = await User.find(baseQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(baseQuery);

    // Map isAdmin to role for frontend compatibility
    const mapped = users.map((u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: u.isAdmin ? 'admin' : 'user',
      isBlocked: u.isBlocked,
      createdAt: (u as any).createdAt,
    }));
    res.json({
      data: mapped,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.isAdmin) {
      res.status(400).json({ message: 'Cannot delete admin user' });
      return;
    }
    if (req.params.id === (req as any).user?._id?.toString()) {
      res.status(400).json({ message: 'You cannot delete your own account' });
      return;
    }

    // Bug #131: Soft-delete users so order/review foreign keys remain valid.
    // We still scrub PII (email, phone, address) and clear ephemeral data
    // (cart, abandoned carts), but the User doc stays so populate() works.
    await Promise.all([
      Cart.deleteOne({ user: user._id }),
      user.email ? AbandonedCart.deleteMany({ email: user.email }) : Promise.resolve(),
    ]);

    (user as any).isDeleted = true;
    user.isBlocked = true;
    // Anonymize PII while preserving the document.
    user.email = `deleted-${user._id}@deleted.local`;
    user.phone = undefined;
    user.address = undefined;
    user.city = undefined;
    user.state = undefined;
    user.postalCode = undefined;
    await user.save();

    res.json({ message: 'User soft-deleted; orders preserved for audit' });
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user role (admin/user)
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    // Sprint 5 / BUG-B-045: validate role is in the known set, don't silently
    // demote to "user" because an admin typo'd "amin".
    if (role !== 'admin' && role !== 'user') {
      res.status(400).json({ message: "Role must be 'admin' or 'user'" });
      return;
    }
    // Bug #12: Admin cannot change their own role
    if (req.params.id === (req as any).user?._id?.toString()) {
      res.status(400).json({ message: 'You cannot change your own role' });
      return;
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Sprint 5 / BUG-B-043: refuse to demote the last remaining admin.
    if (user.isAdmin && role !== 'admin') {
      const adminCount = await User.countDocuments({ isAdmin: true });
      if (adminCount <= 1) {
        res.status(400).json({ message: 'Cannot demote the last remaining admin' });
        return;
      }
    }

    user.isAdmin = role === 'admin';
    await user.save();
    res.json({ message: `User role updated to ${role}` });
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Block/Unblock user
// @route   PUT /api/admin/users/:id/block
// @access  Private/Admin
export const toggleUserBlock = async (req: AuthRequest, res: Response) => {
  try {
    const { isBlocked } = req.body;
    // Sprint 5 / BUG-B-044: validate boolean explicitly; don't accept strings.
    if (typeof isBlocked !== 'boolean') {
      res.status(400).json({ message: 'isBlocked must be a boolean' });
      return;
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isAdmin) {
      res.status(400).json({ message: 'Cannot block admin user' });
      return;
    }

    user.isBlocked = isBlocked;
    await user.save();
    res.json({ message: `User ${isBlocked ? 'blocked' : 'unblocked'}` });
  } catch (error: any) {
    if (error?.name === 'CastError') {
      res.status(400).json({ message: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};
