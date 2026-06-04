import 'server-only';
import { ulid } from 'ulid';
import { extract, normalizeLLMConfig, type LLMConfig } from '@/lib/llm';
import { getCategory, isCategoryKey, type CategoryKey } from '@/lib/categories';
import { listGenerations, saveGenerationData } from '@/lib/storage';
import { renderGeneration, type RenderResult } from '@/lib/render-generation';
import { researchKnowledge } from '@/lib/knowledge-research';
import { attachKnowledgeImages } from '@/lib/knowledge-images';
import { attachRecipeImages } from '@/lib/recipe-images';
import type { ImageConfig } from '@/lib/image-generation';

export type JobStatus =
  | 'queued'
  | 'researching'
  | 'extracting'
  | 'rendering'
  | 'done'
  | 'error';

export type GenerationJob = {
  id: string;
  categoryKey: CategoryKey;
  input: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  bytes: number;
  truncated: boolean;
  previewUrl?: string;
  error?: string;
  researchUsage?: { input: number; output: number };
  extractUsage?: { input: number; output: number };
  renderUsage?: RenderResult['usage'];
  llmConfig?: Required<LLMConfig>;
  imageConfig?: Required<ImageConfig>;
};

type JobStore = {
  jobs: Map<string, GenerationJob>;
};

declare global {
  var __generationJobStore: JobStore | undefined;
}

const store: JobStore =
  globalThis.__generationJobStore ?? { jobs: new Map<string, GenerationJob>() };
globalThis.__generationJobStore = store;

function snapshot(job: GenerationJob): GenerationJob {
  return { ...job };
}

function patchJob(id: string, patch: Partial<GenerationJob>) {
  const current = store.jobs.get(id);
  if (!current) return;
  store.jobs.set(id, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

async function runJob(id: string) {
  const job = store.jobs.get(id);
  if (!job) return;

  try {
    const category = await getCategory(job.categoryKey);
    let researchBrief: string | undefined;
    let researchUsage: GenerationJob['researchUsage'];

    if (job.categoryKey === 'knowledge') {
      patchJob(id, { status: 'researching' });
      const research = await researchKnowledge(job.input, job.llmConfig);
      researchBrief = research.brief;
      researchUsage = research.usage;
    }

    patchJob(id, {
      status: 'extracting',
      ...(researchUsage ? { researchUsage } : {}),
    });

    const extractUser = researchBrief
      ? `用户原始需求：\n${job.input}\n\n下面是按横纵分析法获得的研究简报，请优先基于它生成结构化 JSON：\n\n${researchBrief}`
      : job.input;

    const { data: extractedData, usage } = await extract({
      system: category.extractPrompt,
      user: extractUser,
      schema: category.schema,
      llmConfig: job.llmConfig,
      maxTokens: job.categoryKey === 'travel' ? 16000 : 8192,
    });

    const data =
      job.categoryKey === 'recipe'
        ? await attachRecipeImages({
            id,
            data: extractedData,
            imageConfig: job.imageConfig,
          })
        : job.categoryKey === 'knowledge'
          ? await attachKnowledgeImages({
              id,
              data: extractedData,
              imageConfig: job.imageConfig,
            })
          : extractedData;

    await saveGenerationData(id, {
      categoryKey: job.categoryKey,
      input: job.input,
      data,
      researchBrief,
      llmConfig: job.llmConfig,
      imageConfig: job.imageConfig,
    });

    patchJob(id, {
      status: 'rendering',
      extractUsage: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
      },
    });

    const result = await renderGeneration(
      id,
      job.categoryKey,
      job.llmConfig,
      (_chunk, total) => {
        patchJob(id, { bytes: total });
      }
    );

    patchJob(id, {
      status: 'done',
      bytes: result.bytes,
      truncated: result.truncated,
      renderUsage: result.usage,
      previewUrl: `/preview/${id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[jobs]', id, message);
    patchJob(id, { status: 'error', error: message });
  }
}

export function createGenerationJob(
  input: string,
  categoryKey: string,
  llmConfig?: LLMConfig,
  imageConfig?: ImageConfig
): GenerationJob {
  if (!isCategoryKey(categoryKey)) {
    throw new Error('invalid categoryKey');
  }
  const checkedCategoryKey = categoryKey as CategoryKey;

  const now = new Date().toISOString();
  const id = ulid();
  const job: GenerationJob = {
    id,
    categoryKey: checkedCategoryKey,
    input,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    bytes: 0,
    truncated: false,
    llmConfig: normalizeLLMConfig(llmConfig),
    imageConfig: {
      provider: imageConfig?.provider ?? 'image-a',
      model:
        imageConfig?.model ??
        (imageConfig?.provider === 'packy' || imageConfig?.provider === 'image-a'
          ? process.env.IMAGE_PACKY_MODEL || 'gpt-image-2'
          : imageConfig?.provider === 'doubao' || imageConfig?.provider === 'image-c'
          ? process.env.IMAGE_DOUBAO_MODEL || 'doubao-seedream-3-0-t2i-250415'
          : process.env.IMAGE_QWEN_MODEL || 'qwen-image'),
      size: imageConfig?.size ?? '1024x1024',
      enabled: imageConfig?.enabled ?? true,
    },
  };
  store.jobs.set(id, job);

  void runJob(id);
  return snapshot(job);
}

export function listGenerationJobs(): GenerationJob[] {
  return Array.from(store.jobs.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(snapshot);
}

export async function listGenerationJobsWithStored(): Promise<GenerationJob[]> {
  const jobs = new Map<string, GenerationJob>();
  for (const job of listGenerationJobs()) {
    jobs.set(job.id, job);
  }

  const stored = await listGenerations();
  for (const generation of stored) {
    if (jobs.has(generation.id) || !isCategoryKey(generation.categoryKey)) continue;
    jobs.set(generation.id, {
      id: generation.id,
      categoryKey: generation.categoryKey,
      input: generation.input,
      status: 'done',
      createdAt: generation.createdAt,
      updatedAt: generation.createdAt,
      bytes: generation.htmlBytes,
      truncated: false,
      previewUrl: `/preview/${generation.id}`,
      llmConfig: generation.llmConfig,
      imageConfig: generation.imageConfig,
    });
  }

  return Array.from(jobs.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function getGenerationJob(id: string): GenerationJob | null {
  const job = store.jobs.get(id);
  return job ? snapshot(job) : null;
}

export function deleteGenerationJob(id: string): boolean {
  return store.jobs.delete(id);
}
