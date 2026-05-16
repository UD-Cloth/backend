import { Request, Response } from 'express';
import Promotion from '../models/Promotion';

// @desc    Get all promotions
// @route   GET /api/promotions
// @access  Private/Admin
export const getPromotions = async (_req: Request, res: Response) => {
  try {
    const promotions = await Promotion.find({}).sort({ createdAt: -1 });
    res.json(promotions);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Create a promotion
// @route   POST /api/promotions
// @access  Private/Admin
export const createPromotion = async (req: Request, res: Response) => {
  try {
    const { code, type, value, minPurchaseAmount, isActive, usageLimit, expiryDate } = req.body;

    if (!code || !type || value === undefined) {
      res.status(400).json({ message: 'Code, type and value are required' });
      return;
    }
    if (!['percentage', 'fixed'].includes(type)) {
      res.status(400).json({ message: 'Type must be percentage or fixed' });
      return;
    }

    // Sprint 5 / BUG-B-007: validate value bounds. Negative discounts inflate
    // totals; >100% percentage discount drives totals negative.
    const numValue = Number(value);
    if (Number.isNaN(numValue) || numValue <= 0) {
      res.status(400).json({ message: 'Promotion value must be a positive number' });
      return;
    }
    if (type === 'percentage' && numValue > 100) {
      res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
      return;
    }

    const upperCode = String(code).toUpperCase().trim();
    if (upperCode.length === 0 || upperCode.length > 50) {
      res.status(400).json({ message: 'Promotion code must be 1-50 characters' });
      return;
    }
    const existing = await Promotion.findOne({ code: upperCode });
    if (existing) {
      res.status(409).json({ message: 'Promotion code already exists' });
      return;
    }

    const promotion = await Promotion.create({
      code: upperCode,
      type,
      value: numValue,
      minPurchaseAmount:
        minPurchaseAmount !== undefined ? Math.max(0, Number(minPurchaseAmount)) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      usageLimit:
        usageLimit !== undefined ? Math.max(0, Math.floor(Number(usageLimit))) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    });

    res.status(201).json(promotion);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Update a promotion
// @route   PUT /api/promotions/:id
// @access  Private/Admin
export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      res.status(404).json({ message: 'Promotion not found' });
      return;
    }

    const { code, type, value, minPurchaseAmount, isActive, usageLimit, usageCount, expiryDate } = req.body;

    if (code !== undefined) {
      const upperCode = String(code).toUpperCase().trim();
      if (upperCode !== promotion.code) {
        const dup = await Promotion.findOne({ code: upperCode });
        if (dup) {
          res.status(400).json({ message: 'Promotion code already exists' });
          return;
        }
      }
      promotion.code = upperCode;
    }
    if (type !== undefined) {
      if (!['percentage', 'fixed'].includes(type)) {
        res.status(400).json({ message: 'Type must be percentage or fixed' });
        return;
      }
      promotion.type = type;
    }
    // Sprint 5 / BUG-B-007: same bounds on update.
    if (value !== undefined) {
      const numValue = Number(value);
      if (Number.isNaN(numValue) || numValue <= 0) {
        res.status(400).json({ message: 'Promotion value must be a positive number' });
        return;
      }
      const effectiveType = type ?? promotion.type;
      if (effectiveType === 'percentage' && numValue > 100) {
        res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
        return;
      }
      promotion.value = numValue;
    }
    if (minPurchaseAmount !== undefined) promotion.minPurchaseAmount = Math.max(0, Number(minPurchaseAmount));
    if (isActive !== undefined) promotion.isActive = Boolean(isActive);
    if (usageLimit !== undefined) promotion.usageLimit = Math.max(0, Math.floor(Number(usageLimit)));
    if (usageCount !== undefined) promotion.usageCount = Math.max(0, Math.floor(Number(usageCount)));
    if (expiryDate !== undefined) promotion.expiryDate = expiryDate ? new Date(expiryDate) : undefined;

    const updated = await promotion.save();
    res.json(updated);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Delete a promotion
// @route   DELETE /api/promotions/:id
// @access  Private/Admin
export const deletePromotion = async (req: Request, res: Response) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      res.status(404).json({ message: 'Promotion not found' });
      return;
    }
    await Promotion.deleteOne({ _id: promotion._id });
    res.json({ message: 'Promotion removed' });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Validate a promo code against a cart total
// @route   POST /api/promotions/validate
// @access  Public
export const validatePromoCode = async (req: Request, res: Response) => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) {
      res.status(400).json({ valid: false, message: 'Promo code is required' });
      return;
    }
    const total = Number(cartTotal);
    if (isNaN(total) || total < 0) {
      res.status(400).json({ valid: false, message: 'Invalid cart total' });
      return;
    }

    const promotion = await Promotion.findOne({ code: String(code).toUpperCase().trim() });
    if (!promotion) {
      res.status(404).json({ valid: false, message: 'Invalid promo code' });
      return;
    }

    if (!promotion.isActive) {
      res.status(400).json({ valid: false, message: 'This promo code is not active' });
      return;
    }
    if (promotion.expiryDate && promotion.expiryDate.getTime() < Date.now()) {
      res.status(400).json({ valid: false, message: 'This promo code has expired' });
      return;
    }
    if (promotion.usageLimit !== undefined && promotion.usageCount >= promotion.usageLimit) {
      res.status(400).json({ valid: false, message: 'This promo code has reached its usage limit' });
      return;
    }
    if (promotion.minPurchaseAmount !== undefined && total < promotion.minPurchaseAmount) {
      res.status(400).json({
        valid: false,
        message: `Minimum purchase of ${promotion.minPurchaseAmount} required to use this code`,
      });
      return;
    }

    let discountAmount = 0;
    if (promotion.type === 'percentage') {
      discountAmount = (total * promotion.value) / 100;
    } else {
      discountAmount = promotion.value;
    }
    if (discountAmount > total) discountAmount = total;
    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      valid: true,
      discountAmount,
      message: 'Promo code applied successfully',
      promotion,
    });
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// Internal helper - to be called by orderController when an order succeeds with a promo code
export const incrementUsage = async (code: string): Promise<void> => {
  if (!code) return;
  await Promotion.findOneAndUpdate(
    { code: String(code).toUpperCase().trim() },
    { $inc: { usageCount: 1 } }
  );
};

// Sprint 4 / BUG-B-014: decrement on order cancellation or order-save failure.
// Floor at 0 — never let usageCount drop below zero.
export const decrementUsage = async (code: string): Promise<void> => {
  if (!code) return;
  await Promotion.findOneAndUpdate(
    { code: String(code).toUpperCase().trim(), usageCount: { $gt: 0 } },
    { $inc: { usageCount: -1 } }
  );
};
