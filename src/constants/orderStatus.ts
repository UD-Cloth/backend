// Bug #168: shared source of truth for order statuses so the schema enum,
// controller validators, and any future webhook/email handler all agree.
export const ORDER_STATUSES = [
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['Delivered', 'Cancelled'];
