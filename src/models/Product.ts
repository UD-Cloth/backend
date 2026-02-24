import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  category: mongoose.Types.ObjectId;
  sizes: string[];
  colors: { name: string; hex: string }[];
  rating: number;
  reviewCount: number;
  description: string;
  fabric: string;
  isNewItem?: boolean;
  isTrending?: boolean;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  image: { type: String, required: true },
  images: [{ type: String }],
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  sizes: [{ type: String }],
  colors: [{
    name: { type: String, required: true },
    hex: { type: String, required: true }
  }],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  description: { type: String, required: true },
  fabric: { type: String, required: true },
  isNewItem: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false }
}, {
  timestamps: true,
});

export default mongoose.model<IProduct>('Product', ProductSchema);
