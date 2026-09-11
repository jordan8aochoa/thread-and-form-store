import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { serviceDb, checked, required } from './db';
import { AuthorizationError } from './auth';
export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function token() {
  return randomBytes(32).toString('hex');
}
export function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function secretEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function appUrl() {
  return required('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
}
export function assertOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(appUrl()).origin)
    throw new PublicError('Please reload the page and try again.', 403);
}
export async function jsonBody(request: Request) {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new PublicError('JSON is required.', 415);
  const maxBytes = 32_768;
  if (Number(request.headers.get('content-length')) > maxBytes)
    throw new PublicError('Request too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError('Invalid request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new PublicError('Request too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new PublicError('Invalid request.');
  }
}
export async function rateLimit(
  request: Request,
  action: string,
  limit = 20,
  windowSeconds = 600,
  identity?: string,
) {
  // On Vercel x-vercel-forwarded-for is overwritten by the trusted edge. Never trust arbitrary proxy headers elsewhere.
  const ip = process.env.VERCEL
    ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ?? 'unknown')
    : 'local';
  const key = hash(`${action}:${identity ?? ip}:${required('RATE_LIMIT_SALT')}`);
  const allowed = checked(
    await serviceDb().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }),
  );
  if (!allowed) throw new PublicError('Too many requests. Please try again in a few minutes.', 429);
}
export function errorResponse(error: unknown, operation: string) {
  if (error instanceof ZodError)
    return Response.json(
      { error: 'Please check the highlighted details and try again.', fields: error.flatten() },
      { status: 400 },
    );
  if (error instanceof PublicError || error instanceof AuthorizationError)
    return Response.json({ error: error.message }, { status: error.status });
  // Only log operation and error class: provider error messages can contain customer data.
  console.error(
    JSON.stringify({ operation, error: error instanceof Error ? error.name : 'UnknownError' }),
  );
  return Response.json(
    { error: 'We could not complete that request. Please try again shortly.' },
    { status: 503 },
  );
}
