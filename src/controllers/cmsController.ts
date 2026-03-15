import { Response } from 'express';
import CMS, { HeroSlide, PromoBanner, Testimonial } from '../models/CMS';
import { AuthRequest } from '../middleware/authMiddleware';

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
export const getCMS = async (req: any, res: Response) => {
  try {
    let cms = await CMS.findOne({ storeId: 'main' });

    if (!cms) {
      cms = await CMS.create(DEFAULT_CMS);
    }

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

    let cms = await CMS.findOne({ storeId: 'main' });

    if (!cms) {
      cms = await CMS.create(DEFAULT_CMS);
    }

    cms.heroSlides = slides;
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

    let cms = await CMS.findOne({ storeId: 'main' });

    if (!cms) {
      cms = await CMS.create(DEFAULT_CMS);
    }

    if (isActive !== undefined) cms.promoBanner.isActive = isActive;
    if (text !== undefined) cms.promoBanner.text = text;
    if (link !== undefined) cms.promoBanner.link = link;
    if (bgColor !== undefined) cms.promoBanner.bgColor = bgColor;
    if (textColor !== undefined) cms.promoBanner.textColor = textColor;

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

    let cms = await CMS.findOne({ storeId: 'main' });

    if (!cms) {
      cms = await CMS.create(DEFAULT_CMS);
    }

    cms.testimonials = testimonials;
    await cms.save();

    res.json(cms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
