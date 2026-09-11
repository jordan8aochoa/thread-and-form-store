import { handleAdminRequest } from '@/lib/server/admin-api';
export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
export async function POST(request: Request, context: Context) {
  return handleAdminRequest(request, (await context.params).path);
}
export async function DELETE(request: Request, context: Context) {
  return handleAdminRequest(request, (await context.params).path);
}
