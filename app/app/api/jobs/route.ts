import { NextRequest } from 'next/server';
import {
  createGenerationJob,
  deleteGenerationJob,
  listGenerationJobsWithStored,
} from '@/lib/jobs';
import { deleteGeneration } from '@/lib/storage';
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

export async function GET() {
  return Response.json({ jobs: await listGenerationJobsWithStored() });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const input = body.input?.trim();
  if (!input) {
    return Response.json({ error: 'input is required' }, { status: 400 });
  }

  try {
    const job = createGenerationJob(
      input,
      body.categoryKey ?? '',
      body.llmConfig,
      body.imageConfig
    );
    return Response.json({ job }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const existed = deleteGenerationJob(id);
  await deleteGeneration(id);
  return Response.json({ id, deleted: existed });
}
