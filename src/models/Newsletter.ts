import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletter extends Document {
  email: string;
  status: 'Subscribed' | 'Unsubscribed';
}

const NewsletterSchema: Schema = new Schema(
  {
    // Sprint 5 / BUG-B-025: enforce email format at the schema level too.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    status: { type: String, enum: ['Subscribed', 'Unsubscribed'], default: 'Subscribed' },
  },
  { timestamps: true }
);

export default mongoose.model<INewsletter>('Newsletter', NewsletterSchema);
