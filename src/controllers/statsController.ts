import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getStats = async (_req: Request, res: Response) => {
  try {
    const [totalRevenueResult, totalOrders, totalProducts, totalCustomers, ordersByDay] = await Promise.all([
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
      Order.countDocuments(),
      Product.countDocuments(),
      User.countDocuments(),
      Order.aggregate([
        { $match: { createdAt: { $exists: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
    ]);

    const totalRevenue = totalRevenueResult[0]?.total ?? 0;

    res.json({
      totalRevenue,
      totalOrders,
      totalProducts,
      totalCustomers,
      ordersOverTime: ordersByDay.map((d) => ({
        date: d._id,
        count: d.count,
        revenue: d.revenue,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
