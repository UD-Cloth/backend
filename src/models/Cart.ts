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
  items: [CartItemSchema],
}, {
  timestamps: true,
});

// Sprint 6 / BUG-B-060: enforce a hard cap on items array at the schema level.
// Belt-and-braces with the controller's `MAX_CART_ITEMS=100` (Sprint 4).
const MAX_CART_ITEMS = 100;
CartSchema.pre('validate', function () {
  const items = (this as any).items;
  if (Array.isArray(items) && items.length > MAX_CART_ITEMS) {
    this.invalidate('items', `Cart cannot exceed ${MAX_CART_ITEMS} distinct items`);
  }
});

// Bug #119: Cart sync race — unique compound index on (user, items.variantId)
// guarantees a given variant cannot be inserted twice for the same user even
// under concurrent sync requests.
CartSchema.index({ user: 1, 'items.variantId': 1 }, { unique: true, sparse: true });

export default mongoose.model<ICart>('Cart', CartSchema);
