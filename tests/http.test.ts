import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/server/db', () => ({
  serviceDb: () => ({ rpc }),
  checked: <T>(result: { data: T; error: unknown }) => {
    if (result.error) throw result.error;
    return result.data;
  },
  required: (key: string) => {
    const value = process.env[key];
    if (!value) throw new Error('Missing configuration');
    return value;
  },
}));
import {
  assertOrigin,
  jsonBody,
  errorResponse,
  PublicError,
  rateLimit,
  hash,
  secretEqual,
} from '@/lib/server/http';
describe('sensitive request boundaries', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://store.example.com');
    vi.stubEnv('RATE_LIMIT_SALT', 'fixture-salt');
    rpc.mockReset();
    vi.restoreAllMocks();
  });
  it('rejects cross-origin and originless mutation requests', () => {
    expect(() => assertOrigin(new Request('https://store.example.com/api/contact'))).toThrow();
    expect(() =>
      assertOrigin(
        new Request('https://store.example.com/api/contact', {
          headers: { origin: 'https://attacker.example' },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertOrigin(
        new Request('https://store.example.com/api/contact', {
          headers: { origin: 'https://store.example.com' },
        }),
      ),
    ).not.toThrow();
  });
  it('requires bounded valid JSON', async () => {
    await expect(
      jsonBody(new Request('https://store.example.com', { method: 'POST', body: '{}' })),
    ).rejects.toThrow();
    await expect(
      jsonBody(
        new Request('https://store.example.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        }),
      ),
    ).rejects.toThrow();
    await expect(
      jsonBody(
        new Request('https://store.example.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: 'x'.repeat(33000) }),
        }),
      ),
    ).rejects.toThrow();
    await expect(
      jsonBody(
        new Request('https://store.example.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"ok":true}',
        }),
      ),
    ).resolves.toEqual({ ok: true });
  });
  it('does not expose provider errors or secrets to customers or logs', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = errorResponse(
      new Error('fixture-private-key fixture-customer@example.com'),
      'checkout',
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('fixture');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('fixture');
  });
  it('preserves friendly errors and status codes', async () => {
    const response = errorResponse(new PublicError('Please retry shipping.', 429), 'shipping');
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Please retry shipping.' });
  });
  it('uses a database rate limit with hashed identity', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await rateLimit(
      new Request('https://store.example.com'),
      'order-lookup',
      3,
      60,
      'customer@example.com',
    );
    expect(rpc).toHaveBeenCalledWith(
      'consume_rate_limit',
      expect.objectContaining({
        p_limit: 3,
        p_window_seconds: 60,
        p_key: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('customer@example.com');
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(
      rateLimit(new Request('https://store.example.com'), 'order-lookup'),
    ).rejects.toMatchObject({ status: 429 });
  });
  it('hashes capabilities and compares equal-length secrets safely', () => {
    expect(hash('capability')).toMatch(/^[a-f0-9]{64}$/);
    expect(secretEqual('same', 'same')).toBe(true);
    expect(secretEqual('short', 'longer')).toBe(false);
    expect(secretEqual('aaaa', 'bbbb')).toBe(false);
  });
});
