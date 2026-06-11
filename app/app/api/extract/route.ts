import { NextRequest } from 'next/server';
import { ulid } from 'ulid';
import { extract } from '@/lib/llm';
import { getCategory, isCategoryKey } from '@/lib/categories';
import { saveGenerationData } from '@/lib/storage';
import {
  enforceKnowledgeFreshness,
  researchKnowledge,
} from '@/lib/knowledge-research';
import type { LLMConfig } from '@/lib/llm';
import type { ImageConfig } from '@/lib/image-generation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  input?: string;
  categoryKey?: string;
  llmConfig?: LLMConfig;
  imageConfig?: ImageConfig;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const input = body.input?.trim();
  const categoryKey = body.categoryKey;

  if (!input) {
    return Response.json({ error: 'input is required' }, { status: 400 });
  }
  if (!categoryKey || !isCategoryKey(categoryKey)) {
    return Response.json({ error: 'invalid categoryKey' }, { status: 400 });
  }

  const category = await getCategory(categoryKey);

  try {
    const research =
      categoryKey === 'knowledge'
        ? await researchKnowledge(input, body.llmConfig)
        : null;
    const extractUser = research
      ? `用户原始需求：\n${input}\n\n下面是按横纵分析法获得的研究简报，请优先基于它生成结构化 JSON：\n\n${research.brief}`
      : input;

    const { data: extractedData, usage } = await extract({
      system: category.extractPrompt,
      user: extractUser,
      schema: category.schema,
      llmConfig: body.llmConfig,
    });
    const data =
      categoryKey === 'knowledge' && research
        ? enforceKnowledgeFreshness(extractedData, research)
        : extractedData;

    const id = ulid();
    await saveGenerationData(id, {
      categoryKey,
      input,
      data,
      researchBrief: research?.brief,
      llmConfig: body.llmConfig
        ? {
            provider: body.llmConfig.provider ?? 'openai-compatible',
            model: body.llmConfig.model ?? '',
            baseUrl: body.llmConfig.baseUrl ?? '',
          }
        : undefined,
    });

    return Response.json({
      id,
      data,
      researchUsage: research?.usage,
      usage: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/extract]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
