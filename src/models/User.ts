import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  wishlist: mongoose.Types.ObjectId[];
  isAdmin: boolean;
  isBlocked: boolean;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  // Bug #109: Account lockout fields
  loginAttempts?: number;
  lockUntil?: Date;
  // Bug #131: Soft-delete flag
  isDeleted?: boolean;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  // Sprint 3: lowercase + trim emails so duplicate detection is case-insensitive.
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isAdmin: { type: Boolean, required: true, default: false },
  isBlocked: { type: Boolean, required: true, default: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  // Bug #109: Account lockout after N failed login attempts
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  // Bug #131: Soft-delete users instead of hard-deleting to preserve order FKs
  isDeleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Sprint 3: index reset / verification tokens since we look up users by them
// in the password-reset and email-verify flows. Sparse so unsaved users don't
// collide on null tokens.
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true });

UserSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password as string);
};

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});

export default mongoose.model<IUser>('User', UserSchema);
