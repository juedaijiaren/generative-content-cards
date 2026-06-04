import 'server-only';
import { knowledgeSchema, type KnowledgeData } from '@/categories/knowledge/schema';
import { generateImage, type ImageConfig } from '@/lib/image-generation';
import { saveGenerationAsset } from '@/lib/storage';

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

function cleanQuery(value: string) {
  return value.replace(/[·｜|:：—\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function imageQueries(data: KnowledgeData) {
  const candidates = [
    data.title,
    data.subtitle,
    ...data.sections.map((section) => section.heading),
    ...(data.entities ?? []).map((entity) => entity.name),
    ...(data.horizontal?.peers ?? []),
  ]
    .filter(Boolean)
    .map((item) => cleanQuery(String(item)));

  return Array.from(new Set(candidates)).slice(0, 8);
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

async function commonsSearch(query: string): Promise<CommonsCandidate | null> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '8',
    gsrsearch: query,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: { 'User-Agent': 'generative-content-card/1.0' },
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
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata ?? {};
    const license =
      metadata.LicenseShortName?.value ??
      metadata.UsageTerms?.value ??
      metadata.License?.value;
    const url = info?.thumburl ?? info?.url;
    if (!url || !isUsableLicense(license)) continue;
    return {
      title: (page.title ?? query).replace(/^File:/, ''),
      description: metadata.ImageDescription?.value?.replace(/<[^>]+>/g, ''),
      thumbUrl: url,
      sourceUrl: info?.descriptionurl,
      license,
    };
  }
  return null;
}

async function saveWebImage(id: string, index: number, candidate: CommonsCandidate) {
  if (!candidate.thumbUrl) return null;
  const res = await fetch(candidate.thumbUrl);
  if (!res.ok) return null;
  const url = await saveGenerationAsset(
    id,
    imageFileName(index, extensionFromUrl(candidate.thumbUrl)),
    new Uint8Array(await res.arrayBuffer())
  );
  return {
    title: candidate.title,
    caption: candidate.description?.slice(0, 150),
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
  let imageIndex = 1;
  for (const query of imageQueries(data)) {
    if (images.length >= 3) break;
    try {
      const candidate = await commonsSearch(query);
      if (!candidate) continue;
      const saved = await saveWebImage(args.id, imageIndex, candidate);
      if (!saved) continue;
      imageIndex += 1;
      images.push(saved);
    } catch (err) {
      console.warn('[knowledge.images] web image search failed', err);
    }
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
