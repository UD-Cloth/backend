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
  brand?: string;
  sku?: string;
  stock?: number;
  tags?: string[];
  status?: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
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
    name: { type: String, required: true, trim: true, maxlength: 50 },
    // Sprint 6 / BUG-B-051: validate hex color so admin UI can rely on it
    // (e.g. inline `<div style="background:#…">` swatches). Allows #RGB,
    // #RGBA, #RRGGBB, #RRGGBBAA.
    hex: {
      type: String,
      required: true,
      match: [/^#[0-9a-fA-F]{3,8}$/, 'Color hex must look like "#RRGGBB"'],
    },
  }],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  description: { type: String, required: true },
  fabric: { type: String, required: true },
  isNewItem: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  brand: { type: String },
  sku: { type: String },
  stock: { type: Number, default: 0, min: 0, required: true },
  tags: [{ type: String }],
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
  isFeatured: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false }
}, {
  timestamps: true,
});

// Sprint 3: indexes for the queries the API actually runs.
// - category: browsing by category (`useProductsByCategory`).
// - status:   admin filter and the addOrderItems "is product active" check.
// - feature flags: home-page carousels filter on these.
// - text:     search endpoint.
// - sku:      admin lookups; nullable so use sparse.
ProductSchema.index({ category: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ isNewArrival: 1 });
ProductSchema.index({ isTrending: 1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
// Sprint 5 / BUG-B-050: SKUs are now unique (sparse so legacy products without
// SKU still validate). Two products cannot share an SKU.
ProductSchema.index({ sku: 1 }, { sparse: true, unique: true });

export default mongoose.model<IProduct>('Product', ProductSchema);
