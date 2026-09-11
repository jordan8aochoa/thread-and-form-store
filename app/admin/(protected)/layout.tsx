import { requireAdmin, AuthorizationError } from '@/lib/server/auth';
import { configured } from '@/lib/server/db';
import { redirect } from 'next/navigation';
import { AdminNavigation } from '@/components/admin/controls';
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!configured() || !process.env.SUPABASE_SECRET_KEY) redirect('/admin/login');
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthorizationError) redirect('/admin/login');
    throw e;
  }
  return (
    <div className="admin-shell">
      <AdminNavigation />
      <div className="admin-content">{children}</div>
    </div>
  );
}
