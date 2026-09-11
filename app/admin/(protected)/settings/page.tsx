import { requireAdmin } from '@/lib/server/auth';
import { checked } from '@/lib/server/db';
import { SettingsEditor } from '@/components/admin/settings-editor';
import type { StoreSettings } from '@/lib/types';
export default async function SettingsPage() {
  const { db } = await requireAdmin();
  const settings = checked(
    await db.from('store_settings').select('*').eq('id', 'store').single(),
  ) as StoreSettings;
  return <SettingsEditor key={JSON.stringify(settings)} settings={settings} />;
}
