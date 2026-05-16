import { Response } from 'express';
import CMS, { HeroSlide, PromoBanner, Testimonial } from '../models/CMS';
import { AuthRequest } from '../middleware/authMiddleware';

// Sprint 5 / BUG-B-002: validate CMS payloads. Without these caps an admin
// (compromised or otherwise) could ship megabyte-size hero data to every
// homepage visitor, or inject `javascript:` URLs into a `<a href>`.
const CMS_LIMITS = {
  MAX_HERO_SLIDES: 20,
  MAX_TESTIMONIALS: 50,
  MAX_TEXT: 200,
  MAX_LONG_TEXT: 1000,
  MAX_URL: 500,
};

const isSafeUrl = (raw: any): boolean => {
  if (raw === undefined || raw === null) return true;
  if (typeof raw !== 'string') return false;
  if (raw.length === 0) return true;
  if (raw.length > CMS_LIMITS.MAX_URL) return false;
  // Allow relative paths and http(s) URLs only — block javascript:, data:, etc.
  if (raw.startsWith('/')) return true;
  if (/^https?:\/\//i.test(raw)) return true;
  return false;
};

const isHexColor = (raw: any): boolean =>
  typeof raw === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(raw);

const cap = (raw: any, max: number): string =>
  typeof raw === 'string' ? raw.slice(0, max) : '';

// Sprint 5 / BUG-B-009: race-safe singleton init via upsert.
async function getOrInitCMS() {
  return CMS.findOneAndUpdate(
    { storeId: 'main' },
    { $setOnInsert: DEFAULT_CMS },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

// Default CMS values
// Bug #51/#188: Fixed default CMS — removed curtain/drape/home decor references; updated to fashion store content
const DEFAULT_CMS = {
  storeId: 'main',
  heroSlides: [
    {
      id: 'hero-1',
      image: '/uploads/hero-1.jpg',
      title: 'Premium Men\'s Fashion',
      subtitle: 'Discover our latest collection of premium clothing',
      cta: 'Shop Now',
      link: '/new-arrivals'
    },
    {
      id: 'hero-2',
      image: '/uploads/hero-2.jpg',
      title: 'New Season Arrivals',
      subtitle: 'Fresh styles for every occasion — from casual to formal',
      cta: 'Explore Collection',
      link: '/new-arrivals'
    },
    {
      id: 'hero-3',
      image: '/uploads/hero-3.jpg',
      title: 'Sale — Up to 50% Off',
      subtitle: 'Grab your favourite styles at unbeatable prices',
      cta: 'Shop Sale',
      link: '/sale'
    }
  ],
  promoBanner: {
    isActive: true,
    text: 'Free Shipping on orders above ₹2000 | Use code URBAN10 for 10% off your first order',
    link: '/new-arrivals',
    bgColor: '#111827',
    textColor: '#ffffff'
  },
  testimonials: [
    {
      id: 'testimonial-1',
      name: 'Arjun Mehta',
      role: 'Verified Buyer',
      content: 'Urban Drape\'s quality is outstanding. The fabric feels premium and the fit is perfect. Highly recommended!',
      rating: 5
    },
    {
      id: 'testimonial-2',
      name: 'Karan Singh',
      role: 'Verified Buyer',
      content: 'Amazing collection of shirts and tees. Fast delivery and the packaging was really premium. Will order again!',
      rating: 5
    },
    {
      id: 'testimonial-3',
      name: 'Rahul Verma',
      role: 'Verified Buyer',
      content: 'Best menswear brand online. The hoodies are super comfortable and worth every rupee. Great customer support too.',
      rating: 4
    }
  ]
};

// @desc    Get CMS document (public endpoint)
// @route   GET /api/cms
// @access  Public
export const getCMS = async (_req: any, res: Response) => {
  try {
    const cms = await getOrInitCMS();
    res.json(cms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update hero slides
// @route   PUT /api/cms/hero
// @access  Admin only
export const updateHeroSlides = async (req: AuthRequest, res: Response) => {
  try {
    const { slides } = req.body;

    if (!Array.isArray(slides)) {
      res.status(400).json({ message: 'Slides must be an array' });
      return;
    }
    if (slides.length > CMS_LIMITS.MAX_HERO_SLIDES) {
      res.status(400).json({ message: `Maximum ${CMS_LIMITS.MAX_HERO_SLIDES} hero slides allowed` });
      return;
    }
    for (const s of slides) {
      if (!s || typeof s !== 'object') {
        res.status(400).json({ message: 'Each slide must be an object' });
        return;
      }
      if (!isSafeUrl(s.link)) {
        res.status(400).json({ message: 'Slide link must be a relative path or http(s) URL' });
        return;
      }
      if (!isSafeUrl(s.image)) {
        res.status(400).json({ message: 'Slide image must be a relative path or http(s) URL' });
        return;
      }
    }

    const safeSlides = slides.map((s: any) => ({
      id: cap(s.id, 50) || `hero-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      image: cap(s.image, CMS_LIMITS.MAX_URL),
      title: cap(s.title, CMS_LIMITS.MAX_TEXT),
      subtitle: cap(s.subtitle, CMS_LIMITS.MAX_LONG_TEXT),
      cta: cap(s.cta, 50),
      link: cap(s.link, CMS_LIMITS.MAX_URL),
    }));

    const cms = await getOrInitCMS();
    cms.heroSlides = safeSlides as any;
    await cms.save();
    res.json(cms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update promo banner
// @route   PUT /api/cms/promo
// @access  Admin only
export const updatePromoBanner = async (req: AuthRequest, res: Response) => {
  try {
    const { isActive, text, link, bgColor, textColor } = req.body;

    if (link !== undefined && !isSafeUrl(link)) {
      res.status(400).json({ message: 'link must be a relative path or http(s) URL' });
      return;
    }
    if (bgColor !== undefined && bgColor !== '' && !isHexColor(bgColor)) {
      res.status(400).json({ message: 'bgColor must be a hex color' });
      return;
    }
    if (textColor !== undefined && textColor !== '' && !isHexColor(textColor)) {
      res.status(400).json({ message: 'textColor must be a hex color' });
      return;
    }

    const cms = await getOrInitCMS();

    if (isActive !== undefined) cms.promoBanner.isActive = Boolean(isActive);
    if (text !== undefined) cms.promoBanner.text = cap(text, CMS_LIMITS.MAX_LONG_TEXT);
    if (link !== undefined) cms.promoBanner.link = cap(link, CMS_LIMITS.MAX_URL);
    if (bgColor !== undefined) cms.promoBanner.bgColor = cap(bgColor, 20);
    if (textColor !== undefined) cms.promoBanner.textColor = cap(textColor, 20);

    await cms.save();
    res.json(cms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update testimonials
// @route   PUT /api/cms/testimonials
// @access  Admin only
export const updateTestimonials = async (req: AuthRequest, res: Response) => {
  try {
    const { testimonials } = req.body;

    if (!Array.isArray(testimonials)) {
      res.status(400).json({ message: 'Testimonials must be an array' });
      return;
    }
    if (testimonials.length > CMS_LIMITS.MAX_TESTIMONIALS) {
      res.status(400).json({
        message: `Maximum ${CMS_LIMITS.MAX_TESTIMONIALS} testimonials allowed`,
      });
      return;
    }

    const safeTestimonials = testimonials.map((t: any) => ({
      id: cap(t?.id, 50) || `testimonial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cap(t?.name, 100),
      role: cap(t?.role, 100),
      content: cap(t?.content, CMS_LIMITS.MAX_LONG_TEXT),
      rating: Math.max(1, Math.min(5, Math.floor(Number(t?.rating) || 5))),
    }));

    const cms = await getOrInitCMS();
    cms.testimonials = safeTestimonials as any;
    await cms.save();
    res.json(cms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
