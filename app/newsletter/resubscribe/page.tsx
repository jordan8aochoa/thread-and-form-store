import type { Metadata } from 'next';
import { Unsubscribe } from '@/components/unsubscribe';
export const metadata: Metadata = {
  title: 'Confirm subscription',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <Unsubscribe token={(await searchParams).token || ''} rejoin />;
}
