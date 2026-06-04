import { promises as fs } from 'node:fs';
import path from 'node:path';
import 'server-only';
import type { LLMConfig } from '@/lib/llm';
import type { ImageConfig } from '@/lib/image-generation';

const ROOT = path.join(process.cwd(), 'storage', 'generations');

async function ensureDir() {
  await fs.mkdir(ROOT, { recursive: true });
}

export type GenerationData = {
  id: string;
  categoryKey: string;
  input: string;
  data: unknown;
  researchBrief?: string;
  llmConfig?: Required<LLMConfig>;
  imageConfig?: Required<ImageConfig>;
  html?: string;
  createdAt: string;
};

export async function saveGenerationData(
  id: string,
  payload: Omit<GenerationData, 'id' | 'createdAt'> & { createdAt?: string }
) {
  await ensureDir();
  const full: GenerationData = {
    id,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    ...payload,
  };
  await fs.writeFile(path.join(ROOT, `${id}.json`), JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

export async function saveGenerationHtml(id: string, html: string) {
  await ensureDir();
  await fs.writeFile(path.join(ROOT, `${id}.html`), html, 'utf-8');
}

export async function saveGenerationAsset(
  id: string,
  filename: string,
  bytes: Uint8Array
) {
  await ensureDir();
  const dir = path.join(ROOT, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), bytes);
  return `/asset/${id}/${filename}`;
}

export async function loadGeneration(id: string): Promise<GenerationData> {
  const raw = await fs.readFile(path.join(ROOT, `${id}.json`), 'utf-8');
  return JSON.parse(raw) as GenerationData;
}

export async function loadGenerationHtml(id: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(ROOT, `${id}.html`), 'utf-8');
  } catch {
    return null;
  }
}

export async function listGenerations(): Promise<
  Array<GenerationData & { htmlBytes: number }>
> {
  await ensureDir();
  const files = await fs.readdir(ROOT);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));
  const generations = await Promise.all(
    jsonFiles.map(async (file) => {
      const id = file.slice(0, -'.json'.length);
      const raw = await fs.readFile(path.join(ROOT, file), 'utf-8');
      const data = JSON.parse(raw) as GenerationData;
      const htmlStat = await fs
        .stat(path.join(ROOT, `${id}.html`))
        .catch(() => null);
      return {
        ...data,
        htmlBytes: htmlStat?.size ?? 0,
      };
    })
  );
  return generations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadGenerationAsset(
  id: string,
  filename: string
): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(ROOT, id, filename));
  } catch {
    return null;
  }
}

export async function deleteGeneration(id: string) {
  await ensureDir();
  await Promise.allSettled([
    fs.rm(path.join(ROOT, `${id}.json`), { force: true }),
    fs.rm(path.join(ROOT, `${id}.html`), { force: true }),
    fs.rm(path.join(ROOT, id), { force: true, recursive: true }),
  ]);
}
