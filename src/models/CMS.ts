import mongoose, { Document, Schema } from 'mongoose';

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
}

export interface PromoBanner {
  isActive: boolean;
  text: string;
  link: string;
  bgColor: string;
  textColor: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
}

export interface ICMS extends Document {
  storeId: string;
  heroSlides: HeroSlide[];
  promoBanner: PromoBanner;
  testimonials: Testimonial[];
}

const HeroSlideSchema: Schema = new Schema({
  id: { type: String, required: true },
  image: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  cta: { type: String, required: true },
  link: { type: String, required: true }
});

const PromoBannerSchema: Schema = new Schema({
  isActive: { type: Boolean, default: true },
  text: { type: String, required: true },
  link: { type: String, required: true },
  bgColor: { type: String, default: '#ff6b6b' },
  textColor: { type: String, default: '#ffffff' }
});

const TestimonialSchema: Schema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 }
});

const CMSSchema: Schema = new Schema({
  storeId: { type: String, required: true, unique: true, default: 'main' },
  heroSlides: [HeroSlideSchema],
  promoBanner: PromoBannerSchema,
  testimonials: [TestimonialSchema]
}, {
  timestamps: true
});

export default mongoose.model<ICMS>('CMS', CMSSchema);
