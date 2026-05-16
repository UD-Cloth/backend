import { Request, Response } from 'express';
import Settings, { ISettings } from '../models/Settings';

// Sprint 6 / BUG-B-010: race-safe singleton init. Two parallel cold-start calls
// previously could both run `Settings.create({})` and produce two docs.
// `findOneAndUpdate({}, $setOnInsert, { upsert: true })` is atomic.
const getOrCreateSettings = async (): Promise<ISettings> => {
  const settings = await Settings.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return settings as ISettings;
};

// @desc    Get store settings (public-safe)
// @route   GET /api/settings
// @access  Public
export const getSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    const obj = settings.toObject() as Record<string, unknown>;
    delete obj.razorpayKeySecret;
    res.json(obj);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};

// @desc    Update store settings
// @route   PUT /api/settings
// @access  Private/Admin
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();

    const allowedFields: (keyof ISettings)[] = [
      'storeName',
      'contactEmail',
      'storeDescription',
      'supportPhone',
      'defaultCurrency',
      'streetAddress',
      'city',
      'stateProvince',
      'zipCode',
      'codEnabled',
      'razorpayEnabled',
      'razorpayKeyId',
      'razorpayKeySecret',
      'flatShippingRate',
      'freeShippingThreshold',
      'taxPercentage',
      'taxIncludedInPrice',
      'announcementText',
      'isAnnouncementActive',
      'isAnnouncementScrolling',
    ];

    for (const field of allowedFields) {
      const raw = req.body[field as string];
      if (raw === undefined) continue;
      // Sprint 6 / BUG-B-033: never wipe an existing razorpayKeySecret on an
      // empty-string PUT. Admin UI may not echo the secret back, so a save
      // round-trip must not blank it out. Only update when truthy.
      if (field === 'razorpayKeySecret' && (typeof raw !== 'string' || raw === '')) {
        continue;
      }
      (settings as any)[field] = raw;
    }

    const updated = await settings.save();
    // Sprint 6 / BUG-B-033: redact the secret in the response too, so it's not
    // available via the admin Settings PUT response or the React Query cache.
    const out = updated.toObject() as Record<string, unknown>;
    if (out.razorpayKeySecret) out.razorpayKeySecret = '••••••••';
    res.json(out);
  } catch (error: any) {
    const castEr = (error as any); if (castEr.name === 'CastError') { res.status(400).json({ message: 'Invalid ID format' }); return; } res.status(500).json({ message: castEr.message || 'Server error' });
  }
};
