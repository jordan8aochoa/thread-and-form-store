import type { Address, Product, ProductImage, StoreSettings, Variant } from './types';
import type { SnapshotItem } from './commerce';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
export type OrderStatus =
  'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'canceled' | 'refunded';
export type AdminProfile = {
  id: string;
  role: 'owner' | 'admin';
  active: boolean;
  created_at: string;
};
export type ProductRow = Omit<Product, 'product_images' | 'product_variants'> & {
  updated_at: string;
};
export type InventoryAdjustment = {
  id: string;
  variant_id: string | null;
  quantity_change: number;
  reason: string;
  admin_id: string | null;
  order_id: string | null;
  created_at: string;
};
export type Customer = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
};
export type AddressRow = Address & { id: string; customer_id: string | null; created_at: string };
export type Order = {
  id: string;
  order_number: string;
  reservation_id: string | null;
  customer_id: string | null;
  address_id: string | null;
  email: string;
  shipping_address: Address;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  refunded_cents: number;
  discount_code: string | null;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  shipping_service: Json;
  inventory_restored: boolean;
  created_at: string;
  updated_at: string;
};
export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string;
  size: string;
  color: string;
  unit_price_cents: number;
  quantity: number;
  weight_oz: number;
  image_url: string | null;
};
export type Payment = {
  id: string;
  order_id: string;
  stripe_payment_intent_id: string;
  stripe_checkout_session_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
};
export type Shipment = {
  id: string;
  order_id: string;
  easypost_shipment_id: string | null;
  easypost_tracker_id: string | null;
  label_url: string | null;
  carrier: string;
  service: string;
  postage_cents: number;
  tracking_code: string | null;
  tracking_url: string | null;
  status: string;
  created_at: string;
};
export type TrackingEvent = {
  id: string;
  shipment_id: string;
  provider_event_id: string;
  status: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
};
export type Discount = {
  id: string;
  code: string;
  kind: 'fixed' | 'percentage';
  value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  minimum_subtotal_cents: number;
  max_uses: number | null;
  uses: number;
  created_at: string;
};
export type WebhookEvent = { id: string; provider: string; type: string; processed_at: string };
export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};
export type NewsletterSubscriber = {
  id: string;
  email: string;
  token_hash: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};
export type CheckoutQuote = {
  id: string;
  token_hash: string;
  email: string;
  address: Address;
  items: SnapshotItem[];
  subtotal_cents: number;
  discount_id: string | null;
  discount_cents: number;
  shipping_shipment_id: string;
  rates: Json;
  created_at: string;
  expires_at: string;
};
export type CheckoutReservation = {
  id: string;
  quote_id: string;
  rate_id: string;
  status: 'creating' | 'active' | 'paid' | 'expired';
  items: SnapshotItem[];
  subtotal_cents: number;
  discount_id: string | null;
  discount_cents: number;
  shipping_cents: number;
  shipping_service: Json;
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_coupon_id: string | null;
  session_url: string | null;
  expires_at: string;
  created_at: string;
};
export type RefundRequest = {
  id: string;
  order_id: string;
  admin_id: string | null;
  restock: boolean;
  reason: string | null;
  created_at: string;
};
export type Refund = {
  id: string;
  order_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
};
export type OrderEvent = {
  id: string;
  order_id: string;
  kind: string;
  message: string;
  admin_id: string | null;
  created_at: string;
};
export type EmailOutbox = {
  id: string;
  dedupe_key: string;
  kind: string;
  recipient: string | null;
  payload: Json;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  available_at: string;
  lease_until: string | null;
  provider_id: string | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};
export type ShippingQuoteRow = {
  id: string;
  order_id: string;
  easypost_shipment_id: string;
  rates: Json;
  created_at: string;
};
export type LabelOperation = {
  order_id: string;
  easypost_shipment_id: string;
  rate_id: string;
  status: string;
  locked_until: string | null;
  created_at: string;
};
export type OrderLookupToken = {
  token_hash: string;
  order_id: string;
  expires_at: string;
  created_at: string;
};
export type RateLimit = { key: string; count: number; reset_at: string };
/** Domain row models. Use Supabase CLI type generation for your deployed PostgREST schema. */
export type DatabaseModels = {
  admin_profiles: AdminProfile;
  products: ProductRow;
  product_images: ProductImage;
  product_variants: Variant;
  inventory_adjustments: InventoryAdjustment;
  customers: Customer;
  addresses: AddressRow;
  orders: Order;
  order_items: OrderItem;
  payments: Payment;
  shipments: Shipment;
  tracking_events: TrackingEvent;
  discounts: Discount;
  store_settings: StoreSettings;
  webhook_events: WebhookEvent;
  contact_submissions: ContactSubmission;
  newsletter_subscribers: NewsletterSubscriber;
  checkout_quotes: CheckoutQuote;
  checkout_reservations: CheckoutReservation;
  refund_requests: RefundRequest;
  refunds: Refund;
  order_events: OrderEvent;
  email_outbox: EmailOutbox;
  shipping_quotes: ShippingQuoteRow;
  label_operations: LabelOperation;
  order_lookup_tokens: OrderLookupToken;
  rate_limits: RateLimit;
};
