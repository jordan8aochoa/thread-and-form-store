import { z } from 'zod';
import { startCheckout } from '@/lib/server/checkout';
import { assertOrigin, errorResponse, jsonBody, rateLimit } from '@/lib/server/http';
export const runtime = 'nodejs';
const schema = z
  .object({
    quote_id: z.string().regex(/^[a-f0-9]{64}$/),
    rate_id: z.string().regex(/^rate_[a-zA-Z0-9]+$/),
  })
  .strict();
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, 'checkout-session', 10);
    const body = schema.parse(await jsonBody(request));
    return Response.json(await startCheckout(body.quote_id, body.rate_id));
  } catch (error) {
    return errorResponse(error, 'checkout-session');
  }
}
