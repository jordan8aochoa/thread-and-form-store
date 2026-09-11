import { z } from 'zod';
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    subject: z.enum([
      'Order question',
      'Sizing & product details',
      'Returns & exchanges',
      'Something else',
    ]),
    message: z.string().trim().min(10).max(5000),
    website: z.string().max(300).optional().default(''),
  })
  .strict();
export const newsletterSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    consent: z.literal(true),
  })
  .strict();
export const unsubscribeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
