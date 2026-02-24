import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  selectedOptions: {
    name: string;
    value: string;
  }[];
}

export interface ICart extends Document {
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
}

const CartItemSchema = new Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: String, required: true },
  variantTitle: { type: String, required: true },
  price: {
    amount: { type: String, required: true },
    currencyCode: { type: String, required: true, default: 'INR' }
  },
  quantity: { type: Number, required: true, default: 1 },
  selectedOptions: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }]
}, { _id: false });

const CartSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [CartItemSchema]
}, {
  timestamps: true,
});

export default mongoose.model<ICart>('Cart', CartSchema);
