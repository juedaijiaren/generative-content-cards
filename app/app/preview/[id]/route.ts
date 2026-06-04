import { NextRequest } from 'next/server';
import { loadGenerationHtml } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SNAPSHOT_SCRIPT = `<script>
  (function () {
    var params = new URLSearchParams(location.search);
    if (params.get('mode') === 'snapshot') {
      document.body.classList.add('snapshot');
      return;
    }

    function fitPreview() {
      var canvas = document.querySelector('.canvas');
      if (!canvas) return;
      var scale = Math.min(1, window.innerWidth / 1920);
      canvas.style.setProperty('--preview-scale', String(scale));
      var height = Math.ceil(canvas.scrollHeight * scale);
      document.documentElement.style.minHeight = height + 'px';
      document.body.style.minHeight = height + 'px';
    }

    window.addEventListener('resize', fitPreview);
    window.addEventListener('load', fitPreview);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitPreview).catch(function () {});
    }
    setTimeout(fitPreview, 0);
    setTimeout(fitPreview, 600);
    setTimeout(fitPreview, 1600);
  })();
</script>`;

const PREVIEW_STYLE = `<style>
  body:not(.snapshot) {
    margin: 0 !important;
    overflow: auto !important;
  }
  body:not(.snapshot) .canvas {
    --preview-scale: min(1, calc(100vw / 1920px));
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 1920px !important;
    transform-origin: 0 0 !important;
    transform: scale(var(--preview-scale)) !important;
  }
</style>`;

function injectSnapshotScript(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${PREVIEW_STYLE}\n${SNAPSHOT_SCRIPT}\n</body>`);
  }
  return html + PREVIEW_STYLE + SNAPSHOT_SCRIPT;
}

function avoidSnapshotBlocking(html: string): string {
  return html.replace(
    /<script([^>]*\bsrc=(?:"[^"]*"|'[^']*')[^>]*)><\/script>/gi,
    (match, attrs: string) => {
      if (/\basync\b|\bdefer\b/i.test(attrs)) return match;
      return `<script async${attrs}></script>`;
    }
  );
}

export async function GET(
  req: NextRequest,
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

  const isSnapshot = req.nextUrl.searchParams.get('mode') === 'snapshot';
  const previewHtml = injectSnapshotScript(isSnapshot ? avoidSnapshotBlocking(html) : html);

  return new Response(previewHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
