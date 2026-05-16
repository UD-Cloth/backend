import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';

// Sprint 7 / BUG-B-059: 60-second in-memory cache so the dashboard's 30s poll
// (`useAdminStats` in Sprint 5) doesn't run four full-collection aggregates
// per admin per dashboard view. Cache is process-local; on multi-instance
// deploys each instance has its own copy, which is fine for a stats endpoint.
type StatsPayload = {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  ordersOverTime: { date: string; count: number; revenue: number }[];
};
const CACHE_TTL_MS = 60 * 1000;
let cache: { value: StatsPayload; expires: number } | null = null;

const computeStats = async (): Promise<StatsPayload> => {
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
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]),
  ]);

  return {
    totalRevenue: totalRevenueResult[0]?.total ?? 0,
    totalOrders,
    totalProducts,
    totalCustomers,
    ordersOverTime: ordersByDay.reverse().map((d) => ({
      date: d._id,
      count: d.count,
      revenue: d.revenue,
    })),
  };
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getStats = async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cache && cache.expires > now) {
      res.set('X-Cache', 'hit');
      res.json(cache.value);
      return;
    }
    const value = await computeStats();
    cache = { value, expires: now + CACHE_TTL_MS };
    res.set('X-Cache', 'miss');
    res.json(value);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
