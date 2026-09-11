import type { Metadata } from 'next';
import { CartPage } from '@/components/cart-page';
export const metadata: Metadata = { title: 'Your bag', robots: { index: false, follow: true } };
export default CartPage;
