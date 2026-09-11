import { requireAdmin } from '@/lib/server/auth';
import { checked } from '@/lib/server/db';
import { DiscountManager, type AdminDiscount } from '@/components/admin/discount-manager';
export default async function DiscountsPage() {
  const { db } = await requireAdmin();
  const discounts = checked(
    await db.from('discounts').select('*').order('created_at', { ascending: false }).limit(1000),
  ) as AdminDiscount[];
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Something to say thank you</p>
          <h1>Little extras.</h1>
          <p>Create and manage offers for your community.</p>
        </div>
      </div>
      <DiscountManager discounts={discounts} />
    </>
  );
}
