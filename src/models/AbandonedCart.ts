import mongoose, { Document, Schema } from 'mongoose';

export interface IAbandonedCartItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface IAbandonedCart extends Document {
  sessionId: string;
  email?: string;
  items: IAbandonedCartItem[];
  totalValue: number;
  checkoutStarted: boolean;
  pageAbandoned: string;
}

const AbandonedCartItemSchema: Schema = new Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    size: { type: String },
    color: { type: String },
  },
  { _id: false }
);

const AbandonedCartSchema: Schema = new Schema(
  {
    sessionId: { type: String, required: true },
    email: { type: String },
    items: [AbandonedCartItemSchema],
    totalValue: { type: Number, required: true, default: 0 },
    checkoutStarted: { type: Boolean, default: false },
    pageAbandoned: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IAbandonedCart>('AbandonedCart', AbandonedCartSchema);
