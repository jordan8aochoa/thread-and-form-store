import { required } from '@/lib/server/db';
import { errorResponse, PublicError, secretEqual } from '@/lib/server/http';
import { runJobs } from '@/lib/server/jobs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    if (
      !secretEqual(request.headers.get('authorization') ?? '', `Bearer ${required('CRON_SECRET')}`)
    )
      throw new PublicError('Unauthorized.', 401);
    return Response.json(await runJobs(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error, 'jobs');
  }
}
