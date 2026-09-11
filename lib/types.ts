export type Address = {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
};
export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  position: number;
};
export type Variant = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string;
  price_override_cents: number | null;
  inventory_quantity: number;
  weight_oz: number;
  active: boolean;
};
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price_cents: number;
  sale_price_cents: number | null;
  active: boolean;
  featured: boolean;
  seo_title: string;
  seo_description: string;
  created_at: string;
  product_images: ProductImage[];
  product_variants: Variant[];
};
export type StoreSettings = {
  id: 'store';
  brand_name: string;
  tagline: string;
  logo_url: string;
  support_email: string;
  owner_email: string;
  return_address: Address;
  free_shipping_threshold_cents: number;
  announcement: string;
  social_links: Record<string, string>;
};
export type CartInput = { variant_id: string; quantity: number };
export type CartLine = CartInput & {
  product_id: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  price_cents: number;
  image: string;
  available: number;
};
export type ShippingRate = {
  id: string;
  carrier: string;
  service: string;
  amount_cents: number;
  delivery_days: number | null;
};
export type ShippingQuote = {
  quote_id: string;
  items: {
    variant_id: string;
    name: string;
    size: string;
    color: string;
    quantity: number;
    unit_price_cents: number;
    image_url: string | null;
  }[];
  address: Address;
  rates: ShippingRate[];
  subtotal_cents: number;
  discount_cents: number;
};
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const unitPrice = (product: Product, variant?: Variant) =>
  variant?.price_override_cents ?? product.sale_price_cents ?? product.price_cents;
