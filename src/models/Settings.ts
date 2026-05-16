import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  storeName: string;
  contactEmail: string;
  storeDescription: string;
  supportPhone: string;
  defaultCurrency: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  zipCode: string;
  codEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  flatShippingRate: number;
  freeShippingThreshold: number;
  taxPercentage: number;
  taxIncludedInPrice: boolean;
  announcementText: string;
  isAnnouncementActive: boolean;
  isAnnouncementScrolling: boolean;
}

const SettingsSchema: Schema = new Schema(
  {
    storeName: { type: String, default: 'URBAN DRAPE' },
    contactEmail: { type: String, default: 'support@urbandrape.com' },
    storeDescription: {
      type: String,
      default: 'Premium urban clothing brand delivering high-quality streetwear across the country.',
    },
    supportPhone: { type: String, default: '+91 9876543210' },
    defaultCurrency: { type: String, default: 'INR' },
    streetAddress: { type: String, default: '123 Commerce Avenue, Suite 400' },
    city: { type: String, default: 'Mumbai' },
    stateProvince: { type: String, default: 'Maharashtra' },
    zipCode: { type: String, default: '400001' },
    codEnabled: { type: Boolean, default: true },
    razorpayEnabled: { type: Boolean, default: false },
    razorpayKeyId: { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '' },
    flatShippingRate: { type: Number, default: 150 },
    freeShippingThreshold: { type: Number, default: 2000 },
    taxPercentage: { type: Number, default: 10 },
    taxIncludedInPrice: { type: Boolean, default: true },
    announcementText: {
      type: String,
      default:
        'Join over 2,340 happy customers this month! Free express shipping on orders over ₹2000.',
    },
    isAnnouncementActive: { type: Boolean, default: true },
    isAnnouncementScrolling: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISettings>('Settings', SettingsSchema);
