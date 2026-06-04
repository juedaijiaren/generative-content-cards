import 'server-only';

export type ImageProvider =
  | 'image-a'
  | 'image-b'
  | 'image-c'
  | 'packy'
  | 'qwen'
  | 'doubao';

type ResolvedImageProvider = 'packy' | 'qwen' | 'doubao';

export type ImageConfig = {
  provider?: ImageProvider;
  model?: string;
  size?: string;
  enabled?: boolean;
};

export type GenerateImageRequest = {
  prompt: string;
  config?: ImageConfig;
};

type GeneratedRemoteImage = {
  url?: string;
  b64?: string;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  extension: 'png' | 'jpg' | 'webp';
};

function resolveImageProvider(provider?: ImageProvider): ResolvedImageProvider {
  if (provider === 'qwen' || provider === 'image-b') return 'qwen';
  if (provider === 'doubao' || provider === 'image-c') return 'doubao';
  return 'packy';
}

export function normalizeImageConfig(config?: ImageConfig): Required<ImageConfig> {
  const provider = resolveImageProvider(config?.provider);
  return {
    provider,
    model:
      config?.model?.trim() ||
      (provider === 'packy'
        ? process.env.IMAGE_PACKY_MODEL || 'gpt-image-2'
        : provider === 'qwen'
        ? process.env.IMAGE_QWEN_MODEL || 'qwen-image'
        : process.env.IMAGE_DOUBAO_MODEL || 'doubao-seedream-3-0-t2i-250415'),
    size: config?.size?.trim() || '1024x1024',
    enabled: config?.enabled ?? true,
  };
}

function apiKey(provider: ResolvedImageProvider): string {
  if (provider === 'packy') {
    return process.env.IMAGE_PACKY_API_KEY ?? process.env.PACKY_API_KEY ?? '';
  }
  if (provider === 'qwen') {
    return process.env.DASHSCOPE_API_KEY ?? process.env.IMAGE_QWEN_API_KEY ?? '';
  }
  return (
    process.env.IMAGE_DOUBAO_API_KEY ??
    process.env.ARK_API_KEY ??
    process.env.VOLCENGINE_API_KEY ??
    ''
  );
}

function mimeExtension(contentType: string): GeneratedImage['extension'] {
  if (/webp/i.test(contentType)) return 'webp';
  if (/jpe?g/i.test(contentType)) return 'jpg';
  return 'png';
}

async function downloadImage(url: string): Promise<GeneratedImage> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[image] download failed ${res.status}: ${url.slice(0, 120)}`);
  }
  const contentType = res.headers.get('content-type') ?? 'image/png';
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    extension: mimeExtension(contentType),
  };
}

function fromBase64(b64: string): GeneratedImage {
  return {
    bytes: Uint8Array.from(Buffer.from(b64, 'base64')),
    extension: 'png',
  };
}

function pickFirstImage(json: unknown): GeneratedRemoteImage {
  const root = json as {
    data?: Array<{ url?: string; b64_json?: string }>;
    output?: {
      results?: Array<{ url?: string; b64?: string }>;
      choices?: Array<{
        message?: { content?: Array<{ image?: string; url?: string }> };
      }>;
    };
  };

  const openaiLike = root.data?.[0];
  if (openaiLike?.b64_json) return { b64: openaiLike.b64_json };
  if (openaiLike?.url) return { url: openaiLike.url };

  const qwenContent = root.output?.choices?.[0]?.message?.content ?? [];
  const qwenImage = qwenContent.find((item) => item.image || item.url);
  if (qwenImage?.image || qwenImage?.url) {
    return { url: qwenImage.image ?? qwenImage.url };
  }

  const result = root.output?.results?.[0];
  if (result?.b64) return { b64: result.b64 };
  if (result?.url) return { url: result.url };

  throw new Error(`[image] response did not include an image: ${JSON.stringify(json).slice(0, 500)}`);
}

async function callPackyImage(req: GenerateImageRequest): Promise<GeneratedRemoteImage> {
  const config = normalizeImageConfig(req.config);
  const key = apiKey('packy');
  if (!key) throw new Error('[image.packy] missing IMAGE_PACKY_API_KEY or PACKY_API_KEY');

  const baseUrl = (process.env.IMAGE_PACKY_BASE_URL ?? 'https://www.packyapi.com').replace(
    /\/+$/,
    ''
  );
  const endpoint = process.env.IMAGE_PACKY_ENDPOINT ?? '/v1/images/generations';

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      prompt: req.prompt,
      size: config.size.replace('*', 'x'),
      response_format: process.env.IMAGE_PACKY_RESPONSE_FORMAT ?? 'url',
      n: 1,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[image.packy] request failed ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return pickFirstImage(json);
}

async function callQwenImage(req: GenerateImageRequest): Promise<GeneratedRemoteImage> {
  const config = normalizeImageConfig(req.config);
  const key = apiKey('qwen');
  if (!key) throw new Error('[image.qwen] missing DASHSCOPE_API_KEY or IMAGE_QWEN_API_KEY');

  const baseUrl = (
    process.env.IMAGE_QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1'
  ).replace(/\/+$/, '');
  const endpoint =
    process.env.IMAGE_QWEN_ENDPOINT ??
    '/services/aigc/multimodal-generation/generation';

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: req.prompt }],
          },
        ],
      },
      parameters: {
        size: config.size,
        n: 1,
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[image.qwen] request failed ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return pickFirstImage(json);
}

async function callDoubaoImage(req: GenerateImageRequest): Promise<GeneratedRemoteImage> {
  const config = normalizeImageConfig(req.config);
  const key = apiKey('doubao');
  if (!key) {
    throw new Error('[image.doubao] missing IMAGE_DOUBAO_API_KEY, ARK_API_KEY, or VOLCENGINE_API_KEY');
  }

  const baseUrl = (
    process.env.IMAGE_DOUBAO_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'
  ).replace(/\/+$/, '');
  const endpoint = process.env.IMAGE_DOUBAO_ENDPOINT ?? '/images/generations';

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      prompt: req.prompt,
      size: config.size.replace('*', 'x'),
      response_format: process.env.IMAGE_DOUBAO_RESPONSE_FORMAT ?? 'url',
      n: 1,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[image.doubao] request failed ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return pickFirstImage(json);
}

export async function generateImage(req: GenerateImageRequest): Promise<GeneratedImage> {
  const config = normalizeImageConfig(req.config);
  const remote =
    config.provider === 'packy'
      ? await callPackyImage(req)
      : config.provider === 'qwen'
      ? await callQwenImage(req)
      : await callDoubaoImage(req);

  if (remote.b64) return fromBase64(remote.b64);
  if (remote.url) return downloadImage(remote.url);
  throw new Error('[image] no image returned');
}
