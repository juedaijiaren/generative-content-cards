import { NextRequest } from 'next/server';
import { loadGenerationHtml } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SNAPSHOT_SCRIPT = `<script>
  (function () {
    var params = new URLSearchParams(location.search);
    if (params.get('mode') === 'snapshot') {
      document.body.classList.add('snapshot');
    }
  })();
</script>`;

const PREVIEW_STYLE = `<style>
  body:not(.snapshot) .canvas {
    top: 0 !important;
    transform: translateX(calc((100vw - 1920px * var(--scale)) / 2)) scale(var(--scale)) !important;
  }
</style>`;

function injectSnapshotScript(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${PREVIEW_STYLE}\n${SNAPSHOT_SCRIPT}\n</body>`);
  }
  return html + PREVIEW_STYLE + SNAPSHOT_SCRIPT;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const html = await loadGenerationHtml(id);
  if (!html) {
    return new Response(`<!doctype html><meta charset="utf-8"><title>404</title><body>generation ${id} not found</body>`, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(injectSnapshotScript(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
