import { NextRequest } from 'next/server';
import { isCategoryKey, type CategoryKey } from '@/lib/categories';
import { renderGeneration } from '@/lib/render-generation';
import { loadGeneration } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  id?: string;
  categoryKey?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const id = body.id;
  const categoryKey = body.categoryKey;

  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  if (!categoryKey || !isCategoryKey(categoryKey)) {
    return Response.json({ error: 'invalid categoryKey' }, { status: 400 });
  }
  const checkedCategoryKey = categoryKey as CategoryKey;

  const generation = await loadGeneration(id);
  if (generation.categoryKey !== checkedCategoryKey) {
    return Response.json(
      { error: `categoryKey 与存储记录不符：want ${generation.categoryKey}, got ${checkedCategoryKey}` },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const result = await renderGeneration(
          id,
          checkedCategoryKey,
          generation.llmConfig,
          (chunk, total) => {
            send('chunk', { length: chunk.length, total });
          }
        );
        send('done', result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[api/render]', message);
        send('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
