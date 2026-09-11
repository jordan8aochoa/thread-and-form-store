import { Unsubscribe } from '@/components/unsubscribe';
export const metadata = {
  title: 'Newsletter preferences',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <Unsubscribe token={(await searchParams).token || ''} />;
}
