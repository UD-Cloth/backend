import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  image: string;
}

const CategorySchema: Schema = new Schema({
  // Sprint 3: enforce unique category names; trim whitespace.
  name: { type: String, required: true, unique: true, trim: true },
  image: { type: String, required: true }
}, {
  timestamps: true
});

export default mongoose.model<ICategory>('Category', CategorySchema);
