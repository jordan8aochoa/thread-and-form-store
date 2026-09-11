import { describe, it, expect } from 'vitest';
import { contactSchema, newsletterSchema, unsubscribeSchema } from '@/lib/submissions';
describe('public form validation', () => {
  it('requires explicit newsletter consent', () => {
    expect(newsletterSchema.safeParse({ email: 'test@example.com', consent: false }).success).toBe(
      false,
    );
    expect(newsletterSchema.parse({ email: 'TEST@example.com', consent: true }).email).toBe(
      'test@example.com',
    );
  });
  it('rejects invalid contact email and unbounded text', () => {
    const payload = {
      name: 'Test Customer',
      email: 'not-email',
      subject: 'Order question',
      message: 'Please help with my order.',
    };
    expect(contactSchema.safeParse(payload).success).toBe(false);
    expect(
      contactSchema.safeParse({ ...payload, email: 'test@example.com', message: 'a'.repeat(5001) })
        .success,
    ).toBe(false);
  });
  it('rejects unknown form fields', () =>
    expect(
      newsletterSchema.safeParse({ email: 'test@example.com', consent: true, admin: true }).success,
    ).toBe(false));
  it('requires a full random unsubscribe capability', () => {
    expect(unsubscribeSchema.safeParse({ token: 'short' }).success).toBe(false);
    expect(unsubscribeSchema.safeParse({ token: 'f'.repeat(64) }).success).toBe(true);
  });
});
