import { Request, Response } from 'express';
import User from '../models/User';
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

    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments({});

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

    if (user) {
      if (user.isAdmin) {
        res.status(400).json({ message: 'Cannot delete admin user' });
        return;
      }
      // Bug #153: Prevent admin from deleting themselves
      if (req.params.id === (req as any).user?._id?.toString()) {
        res.status(400).json({ message: 'You cannot delete your own account' });
        return;
      }
      await User.deleteOne({ _id: user._id });
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user role (admin/user)
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    // Bug #12: Admin cannot change their own role (prevent privilege escalation/de-escalation)
    if (req.params.id === (req as any).user?._id?.toString()) {
      res.status(400).json({ message: 'You cannot change your own role' });
      return;
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.isAdmin = role === 'admin';
    await user.save();
    res.json({ message: `User role updated to ${role}` });
  } catch (error: any) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Block/Unblock user
// @route   PUT /api/admin/users/:id/block
// @access  Private/Admin
export const toggleUserBlock = async (req: AuthRequest, res: Response) => {
  try {
    const { isBlocked } = req.body;
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
    res.status(500).json({ message: 'Server Error' });
  }
};
