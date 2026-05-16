import { Request, Response } from 'express';
import Newsletter from '../models/Newsletter';

// @desc    Subscribe to newsletter
// @route   POST /api/newsletter/subscribe
// @access  Public
export const subscribe = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' });
      return;
    }

    const normalized = email.toLowerCase().trim();

    const existing = await Newsletter.findOne({ email: normalized });
    if (existing) {
      if (existing.status === 'Unsubscribed') {
        existing.status = 'Subscribed';
        await existing.save();
      }
      res.status(200).json({ message: 'Subscription confirmed', subscriber: existing });
      return;
    }

    const subscriber = await Newsletter.create({ email: normalized });
    res.status(201).json({ message: 'Subscribed successfully', subscriber });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Get all newsletter subscribers
// @route   GET /api/newsletter
// @access  Private/Admin
export const getSubscribers = async (_req: Request, res: Response) => {
  try {
    const subscribers = await Newsletter.find({}).sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Toggle subscriber status
// @route   PATCH /api/newsletter/:id/toggle
// @access  Private/Admin
export const toggleStatus = async (req: Request, res: Response) => {
  try {
    const subscriber = await Newsletter.findById(req.params.id);
    if (!subscriber) {
      res.status(404).json({ message: 'Subscriber not found' });
      return;
    }
    subscriber.status = subscriber.status === 'Subscribed' ? 'Unsubscribed' : 'Subscribed';
    await subscriber.save();
    res.json(subscriber);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Remove a subscriber
// @route   DELETE /api/newsletter/:id
// @access  Private/Admin
export const removeSubscriber = async (req: Request, res: Response) => {
  try {
    const subscriber = await Newsletter.findById(req.params.id);
    if (!subscriber) {
      res.status(404).json({ message: 'Subscriber not found' });
      return;
    }
    await Newsletter.deleteOne({ _id: subscriber._id });
    res.json({ message: 'Subscriber removed' });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};
