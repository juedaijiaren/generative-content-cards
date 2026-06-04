import { getGenerationJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const job = getGenerationJob(id);
  if (!job) {
    return Response.json({ error: `job not found: ${id}` }, { status: 404 });
  }
  return Response.json({ job });
}
