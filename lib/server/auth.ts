import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { required, serviceDb } from './db';

export class AuthorizationError extends Error {
  status = 403;
}
export async function serverAuth() {
  const jar = await cookies();
  return createServerClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server components cannot set cookies; route handlers refresh sessions. */
          }
        },
      },
    },
  );
}
export async function requireAdmin() {
  const auth = await serverAuth();
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();
  if (error || !user) throw new AuthorizationError('Please sign in as an administrator.');
  const db = serviceDb();
  const { data: profile } = await db
    .from('admin_profiles')
    .select('*')
    .eq('id', user.id)
    .eq('active', true)
    .single();
  if (!profile || !['owner', 'admin'].includes(profile.role))
    throw new AuthorizationError('Administrator access required.');
  return { user, profile, db };
}
