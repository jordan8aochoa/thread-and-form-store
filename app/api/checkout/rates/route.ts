import { createQuote } from '@/lib/server/checkout';
import { assertOrigin, errorResponse, jsonBody, rateLimit } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, 'shipping-rates', 12);
    return Response.json(await createQuote(await jsonBody(request)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error, 'checkout-rates');
  }
}
