import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn(), service: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/lib/server/db', () => ({ required: () => 'fixture', serviceDb: mocks.service }));
import { requireAdmin } from '@/lib/server/auth';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.service.mockReturnValue({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: mocks.single }) }) }) }),
  });
});
describe('admin authorization', () => {
  it('rejects requests without a server-verified Supabase user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it('rejects an invalid session even when it includes user data', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'forged' } },
      error: { message: 'Invalid JWT' },
    });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it('rejects a normal authenticated customer without an active admin profile', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'customer' } }, error: null });
    mocks.single.mockResolvedValue({ data: null });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
  it('rejects an unsupported role rather than trusting user metadata', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'customer', user_metadata: { role: 'admin' } } },
      error: null,
    });
    mocks.single.mockResolvedValue({ data: { id: 'customer', role: 'customer' } });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
  it.each(['owner', 'admin'])(
    'accepts a verified user with authorized %s profile',
    async (role) => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null });
      mocks.single.mockResolvedValue({ data: { id: 'admin-id', role, active: true } });
      expect((await requireAdmin()).profile.role).toBe(role);
      expect(mocks.getUser).toHaveBeenCalledOnce();
    },
  );
});
