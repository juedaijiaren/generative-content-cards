import { NextRequest } from 'next/server';
import { loadGenerationAsset } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function contentType(name: string) {
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await ctx.params;
  const bytes = await loadGenerationAsset(id, name);
  if (!bytes) {
    return new Response('asset not found', { status: 404 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType(name),
      'Cache-Control': 'no-store',
    },
  });
}
