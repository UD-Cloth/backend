import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  image: string;
}

const CategorySchema: Schema = new Schema({
  name: { type: String, required: true },
  image: { type: String, required: true }
}, {
  timestamps: true
});

export default mongoose.model<ICategory>('Category', CategorySchema);
