import 'server-only';
import { knowledgeSchema, type KnowledgeData } from '@/categories/knowledge/schema';
import { generateImage, type ImageConfig } from '@/lib/image-generation';
import { saveGenerationAsset } from '@/lib/storage';
import {
  knowledgeImageAnchors,
  knowledgeImageCandidateScore,
  knowledgeImageQueries,
} from '@/lib/knowledge-image-relevance';

type CommonsCandidate = {
  title: string;
  description?: string;
  thumbUrl?: string;
  sourceUrl?: string;
  license?: string;
};

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

function imageFileName(index: number, extension: string) {
  return `knowledge-image-${String(index).padStart(2, '0')}.${extension}`;
}

function isUsableLicense(license?: string) {
  if (!license) return false;
  return /public domain|cc0|cc-by|cc by|creative commons/i.test(license);
}

function extensionFromUrl(url: string) {
  const clean = url.split('?')[0] ?? '';
  if (/\.webp$/i.test(clean)) return 'webp';
  if (/\.jpe?g$/i.test(clean)) return 'jpg';
  return 'png';
}

function displayTitle(value: string) {
  return value.replace(/\.[a-z0-9]{2,5}$/i, '').replaceAll('_', ' ').trim();
}

function conciseCaption(value?: string) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || text.length <= 150) return text;
  const draft = text.slice(0, 147);
  const boundary = Math.max(
    draft.lastIndexOf('。'),
    draft.lastIndexOf('. '),
    draft.lastIndexOf('；'),
    draft.lastIndexOf('; '),
    draft.lastIndexOf(' ')
  );
  return `${draft.slice(0, boundary >= 100 ? boundary : 147).trim()}…`;
}

async function commonsSearch(
  query: string,
  anchors: string[]
): Promise<CommonsCandidate | null> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '16',
    gsrsearch: query,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: { 'User-Agent': 'generative-content-card/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{
            thumburl?: string;
            url?: string;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(json.query?.pages ?? {});
  const candidates: CommonsCandidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata ?? {};
    const license =
      metadata.LicenseShortName?.value ??
      metadata.UsageTerms?.value ??
      metadata.License?.value;
    const url = info?.thumburl ?? info?.url;
    if (!url || !isUsableLicense(license)) continue;
    candidates.push({
      title: (page.title ?? query).replace(/^File:/, ''),
      description: metadata.ImageDescription?.value?.replace(/<[^>]+>/g, ''),
      thumbUrl: url,
      sourceUrl: info?.descriptionurl,
      license,
    });
  }
  return (
    candidates
      .map((candidate) => ({
        candidate,
        score: knowledgeImageCandidateScore(candidate, query, anchors),
      }))
      .filter((item) => item.score >= (anchors.length ? 8 : 5))
      .sort((a, b) => b.score - a.score)[0]?.candidate ?? null
  );
}

async function saveWebImage(id: string, index: number, candidate: CommonsCandidate) {
  if (!candidate.thumbUrl) return null;
  const res = await fetch(candidate.thumbUrl, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const url = await saveGenerationAsset(
    id,
    imageFileName(index, extensionFromUrl(candidate.thumbUrl)),
    new Uint8Array(await res.arrayBuffer())
  );
  return {
    title: displayTitle(candidate.title),
    caption: conciseCaption(candidate.description),
    imageUrl: url,
    source: 'Wikimedia Commons',
    license: candidate.license,
    sourceUrl: candidate.sourceUrl,
    kind: 'web' as const,
  };
}

function aiPrompt(data: KnowledgeData) {
  return [
    '知识图谱配图，干净现代的信息图视觉',
    '无文字，无水印',
    '真实产品或概念示意优先',
    `主题：${data.title}`,
    data.subtitle ? `副标题：${data.subtitle}` : '',
    `核心观点：${data.keyMessage.replace(/<[^>]+>/g, '')}`,
    '横版 16:9，高细节，适合放入知识卡片',
  ]
    .filter(Boolean)
    .join('，');
}

async function generateFallbackImage(
  id: string,
  data: KnowledgeData,
  config?: ImageConfig
) {
  if (!config?.enabled) return null;
  const image = await generateImage({
    prompt: aiPrompt(data),
    config,
  });
  const url = await saveGenerationAsset(
    id,
    imageFileName(1, image.extension),
    image.bytes
  );
  return {
    title: `${data.title} 示意图`,
    caption: '未找到合适开放图片，使用 AI 生成的示意图。',
    imageUrl: url,
    source: 'AI generated',
    license: 'generated',
    kind: 'ai' as const,
  };
}

export async function attachKnowledgeImages(args: {
  id: string;
  data: unknown;
  imageConfig?: ImageConfig;
}): Promise<unknown> {
  const parsed = knowledgeSchema.safeParse(args.data);
  if (!parsed.success) return args.data;

  const data = parsed.data;
  if (data.images?.length) return data;

  const images = [];
  const anchors = knowledgeImageAnchors(data);
  const queries = knowledgeImageQueries(data, anchors).slice(0, 4);
  const candidates = await Promise.all(
    queries.map(async (query) => {
      try {
        return await commonsSearch(query, anchors);
      } catch {
        return null;
      }
    })
  );
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const saved = await saveWebImage(args.id, 1, candidate);
      if (saved) images.push(saved);
    } catch {
      // Try the next relevant candidate before falling back to generation.
    }
    if (images.length) break;
  }

  if (!images.length) {
    try {
      const generated = await generateFallbackImage(args.id, data, args.imageConfig);
      if (generated) images.push(generated);
    } catch (err) {
      console.warn('[knowledge.images] AI fallback failed', err);
    }
  }

  return images.length ? { ...data, images } : data;
}
