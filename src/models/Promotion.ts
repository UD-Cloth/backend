import mongoose, { Document, Schema } from 'mongoose';

export interface IPromotion extends Document {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchaseAmount?: number;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  expiryDate?: Date;
}

const PromotionSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, required: true, enum: ['percentage', 'fixed'] },
    value: { type: Number, required: true },
    minPurchaseAmount: { type: Number },
    isActive: { type: Boolean, default: true },
    usageLimit: { type: Number },
    usageCount: { type: Number, default: 0 },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IPromotion>('Promotion', PromotionSchema);
