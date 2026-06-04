import { NextRequest } from 'next/server';
import { capture } from '@/lib/snapshot';
import { loadGenerationHtml } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  id?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const id = body.id;
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const html = await loadGenerationHtml(id);
  if (!html) {
    return Response.json(
      { error: `generation html not found for id=${id}（先调 /api/render）` },
      { status: 404 }
    );
  }

  try {
    const buffer = await capture(id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${id}.png"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/snapshot]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
