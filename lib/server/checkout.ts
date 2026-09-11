import 'server-only';
import type Stripe from 'stripe';
import type { Address, Product, ShippingRate } from '../types';
import {
  calculateCart,
  calculateDiscount,
  checkoutSchema,
  type DiscountRecord,
  type SnapshotItem,
} from '../commerce';
import { checked, requiredData, serviceDb } from './db';
import { appUrl, hash, PublicError, token } from './http';
import { quoteShipment, verifyAddress } from './shipping';
import { stripeClient } from './stripe';

export type Reservation = {
  id: string;
  quote_id: string;
  rate_id: string;
  status: string;
  items: SnapshotItem[];
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  shipping_service: ShippingRate;
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
  session_url: string | null;
  expires_at: string;
  created_at: string;
};
export async function createQuote(input: unknown) {
  const values = checkoutSchema.parse(input);
  const db = serviceDb();
  const variantIds = values.items.map((i) => i.variant_id);
  const variants = requiredData(
    await db.from('product_variants').select('product_id').in('id', variantIds),
  );
  const products = checked(
    await db
      .from('products')
      .select('*,product_images(*),product_variants(*)')
      .in('id', [...new Set(variants.map((v) => v.product_id))]),
  ) as Product[];
  let cart;
  try {
    cart = calculateCart(values.items, products);
  } catch (error) {
    throw new PublicError(error instanceof Error ? error.message : 'Please review your bag.');
  }
  let discount: DiscountRecord | null = null;
  if (values.discount_code) {
    discount = checked(
      await db
        .from('discounts')
        .select('*')
        .eq('code', values.discount_code.toUpperCase())
        .maybeSingle(),
    ) as DiscountRecord | null;
    if (!discount) throw new PublicError('This discount code was not found.');
  }
  let discountCents = 0;
  try {
    discountCents = calculateDiscount(discount, cart.subtotal_cents);
  } catch {
    throw new PublicError('This discount is unavailable for your bag.');
  }
  const address = await verifyAddress(values.address);
  const shipment = await quoteShipment({ address, weight_oz: cart.weight_oz });
  const settings = requiredData(
    await db
      .from('store_settings')
      .select('free_shipping_threshold_cents')
      .eq('id', 'store')
      .single(),
  );
  const rates = shipment.rates.map((rate, index) => ({
    ...rate,
    amount_cents:
      settings.free_shipping_threshold_cents > 0 &&
      cart.subtotal_cents - discountCents >= settings.free_shipping_threshold_cents &&
      index === 0
        ? 0
        : rate.amount_cents,
  }));
  if (rates.some((rate) => cart.subtotal_cents - discountCents + rate.amount_cents < 50))
    throw new PublicError(
      'The total after discounts and shipping must be at least $0.50. Please remove this discount or add another item.',
    );
  const rawToken = token();
  checked(
    await db
      .from('checkout_quotes')
      .insert({
        token_hash: hash(rawToken),
        email: values.email,
        address,
        items: cart.items,
        subtotal_cents: cart.subtotal_cents,
        discount_id: discount?.id ?? null,
        discount_cents: discountCents,
        shipping_shipment_id: shipment.id,
        rates,
      }),
  );
  return {
    quote_id: rawToken,
    address,
    rates,
    items: cart.items,
    subtotal_cents: cart.subtotal_cents,
    discount_cents: discountCents,
  };
}
export async function startCheckout(quoteToken: string, rateId: string) {
  const db = serviceDb();
  const quote = checked(
    await db.from('checkout_quotes').select('*').eq('token_hash', hash(quoteToken)).maybeSingle(),
  );
  if (!quote) throw new PublicError('Your shipping quote has expired. Please get new rates.');
  const result = await db.rpc('reserve_checkout', { p_quote_id: quote.id, p_rate_id: rateId });
  if (result.error)
    throw new PublicError(
      'An item, discount, or shipping quote has changed. Please refresh your rates.',
      409,
    );
  const reservation = result.data as Reservation;
  if (reservation.status === 'paid')
    throw new PublicError(
      'This checkout has already been paid. Check your email for the confirmation.',
    );
  if (reservation.status === 'expired')
    throw new PublicError('This checkout has expired. Please refresh shipping rates.');
  if (reservation.stripe_session_id) {
    const existing = await stripeClient().checkout.sessions.retrieve(reservation.stripe_session_id);
    if (existing.status !== 'open' || !existing.url)
      throw new PublicError('This checkout is no longer open. Please refresh shipping rates.');
    return { url: existing.url };
  }
  return createReservedSession(reservation, { email: quote.email, address: quote.address });
}
export function sessionParameters(
  reservation: Reservation,
  customerId: string,
  couponId?: string,
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'payment',
    customer: customerId,
    client_reference_id: reservation.id,
    payment_method_types: ['card'],
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX !== 'false' },
    line_items: reservation.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: item.unit_price_cents,
        tax_behavior: 'exclusive',
        product_data: {
          name: `${item.name} · ${item.size} / ${item.color}`,
          metadata: { variant_id: item.variant_id, sku: item.sku },
          tax_code: process.env.STRIPE_PRODUCT_TAX_CODE ?? 'txcd_30011000',
          ...(item.image_url ? { images: [new URL(item.image_url, appUrl()).href] } : {}),
        },
      },
    })),
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: reservation.shipping_cents, currency: 'usd' },
          display_name: `${reservation.shipping_service.carrier} ${reservation.shipping_service.service}`,
          tax_behavior: 'exclusive',
          tax_code: 'txcd_92010001',
        },
      },
    ],
    metadata: { reservation_id: reservation.id },
    payment_intent_data: { metadata: { reservation_id: reservation.id } },
    success_url: `${appUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/checkout/canceled`,
    expires_at: Math.floor(new Date(reservation.expires_at).getTime() / 1000),
  };
}
export async function createReservedSession(
  reservation: Reservation,
  quote: { email: string; address: Address },
) {
  const db = serviceDb();
  const stripe = stripeClient();
  const address = {
    line1: quote.address.street1,
    line2: quote.address.street2,
    city: quote.address.city,
    state: quote.address.state,
    postal_code: quote.address.zip,
    country: quote.address.country,
  };
  // One fresh Customer per reservation; unverified guest email never selects an existing customer's profile.
  const customer = await stripe.customers.create(
    {
      email: quote.email,
      name: quote.address.name,
      address,
      shipping: {
        name: quote.address.name,
        address,
        ...(quote.address.phone ? { phone: quote.address.phone } : {}),
      },
      metadata: { reservation_id: reservation.id },
    },
    { idempotencyKey: `customer:${reservation.id}` },
  );
  checked(
    await db
      .from('checkout_reservations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', reservation.id),
  );
  let couponId: string | undefined;
  if (reservation.discount_cents > 0) {
    const coupon = await stripe.coupons.create(
      {
        duration: 'once',
        amount_off: reservation.discount_cents,
        currency: 'usd',
        name: 'Store discount',
        metadata: { reservation_id: reservation.id },
      },
      { idempotencyKey: `coupon:${reservation.id}` },
    );
    couponId = coupon.id;
    checked(
      await db
        .from('checkout_reservations')
        .update({ stripe_coupon_id: coupon.id })
        .eq('id', reservation.id),
    );
  }
  const session = await stripe.checkout.sessions.create(
    sessionParameters(reservation, customer.id, couponId),
    { idempotencyKey: `checkout:${reservation.id}` },
  );
  checked(
    await db
      .from('checkout_reservations')
      .update({ stripe_session_id: session.id, session_url: session.url, status: 'active' })
      .eq('id', reservation.id)
      .eq('status', 'creating'),
  );
  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url };
}
