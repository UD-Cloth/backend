import mongoose, { Document, Schema } from 'mongoose';
import { ORDER_STATUSES, OrderStatus } from '../constants/orderStatus';

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  orderItems: {
    name: string;
    qty: number;
    image: string;
    price: number;
    product: mongoose.Types.ObjectId;
    size?: string;
    color?: string;
  }[];
  // Bug #43: Store customer contact info on order for fulfilment
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    address: string;
    city: string;
    postalCode: string;
    state: string;
  };
  paymentMethod: string;
  paymentResult?: {
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };
  // Sprint 4 / BUG-B-001: items subtotal (price × qty across orderItems).
  // Without this, totals can't be reconciled (items + tax + shipping − discount).
  itemsPrice: number;
  taxPrice: number;
  shippingPrice: number;
  couponCode?: string;
  discountAmount?: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  status?: string;
}

const OrderSchema: Schema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderItems: [
    {
      name: { type: String, required: true },
      qty: { type: Number, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
      size: { type: String },
      color: { type: String }
    }
  ],
  // Bug #43: Store customer contact info on order
  customerEmail: { type: String },
  customerPhone: { type: String },
  shippingAddress: {
    firstName: { type: String },
    lastName: { type: String },
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    state: { type: String, required: true }
  },
  paymentMethod: { type: String, required: true },
  paymentResult: {
    id: { type: String },
    status: { type: String },
    update_time: { type: String },
    email_address: { type: String },
  },
  itemsPrice: { type: Number, required: true, default: 0.0 },
  taxPrice: { type: Number, required: true, default: 0.0 },
  shippingPrice: { type: Number, required: true, default: 0.0 },
  couponCode: { type: String },
  discountAmount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true, default: 0.0 },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date },
  // Bug #132/#168: Constrain status to a known enum sourced from shared
  // constants so model + controllers stay in sync.
  status: {
    type: String,
    default: 'Pending' as OrderStatus,
    enum: ORDER_STATUSES,
  },
}, {
  timestamps: true,
});

// Sprint 3: indexes for the order queries the API actually runs.
// - { user, createdAt }: getMyOrders sorts by createdAt for the logged-in user.
// - status: admin filter.
// - createdAt: admin "all orders" sort.
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ couponCode: 1 }, { sparse: true });

export default mongoose.model<IOrder>('Order', OrderSchema);
