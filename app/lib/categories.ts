import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ZodSchema } from 'zod';

import type { CategoryKey, CategoryMeta } from './categories-types';
export type { CategoryKey } from './categories-types';
import { meta as knowledgeMeta } from '@/categories/knowledge/meta';
import { knowledgeSchema } from '@/categories/knowledge/schema';
import { meta as travelMeta } from '@/categories/travel/meta';
import { travelSchema } from '@/categories/travel/schema';
import { meta as recipeMeta } from '@/categories/recipe/meta';
import { recipeSchema } from '@/categories/recipe/schema';

type CategoryConfig = {
  meta: CategoryMeta;
  schema: ZodSchema<unknown>;
  /** 类目目录绝对路径，用于解析 extract prompt */
  baseDir: string;
  /** 外层设计 prompt 源文件，保持与样例目录同源，避免复制维护 */
  designPromptPath: string;
};

const CATEGORIES_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), 'categories');

const registry: Record<CategoryKey, CategoryConfig> = {
  knowledge: {
    meta: knowledgeMeta,
    schema: knowledgeSchema,
    baseDir: path.join(CATEGORIES_ROOT, 'knowledge'),
    designPromptPath: path.join(
      /* turbopackIgnore: true */ process.cwd(),
      '..',
      '知识类',
      'design.prompt.md'
    ),
  },
  travel: {
    meta: travelMeta,
    schema: travelSchema,
    baseDir: path.join(CATEGORIES_ROOT, 'travel'),
    designPromptPath: path.join(
      /* turbopackIgnore: true */ process.cwd(),
      '..',
      '旅游类',
      'design.prompt.md'
    ),
  },
  recipe: {
    meta: recipeMeta,
    schema: recipeSchema,
    baseDir: path.join(CATEGORIES_ROOT, 'recipe'),
    designPromptPath: path.join(
      /* turbopackIgnore: true */ process.cwd(),
      '..',
      '食谱类',
      'design.prompt.md'
    ),
  },
};

export type LoadedCategory = {
  meta: CategoryMeta;
  schema: ZodSchema<unknown>;
  extractPrompt: string;
  designPrompt: string;
};

const cache = new Map<CategoryKey, LoadedCategory>();

export async function getCategory(key: CategoryKey): Promise<LoadedCategory> {
  const cached = cache.get(key);
  if (cached) return cached;

  const cfg = registry[key];
  if (!cfg) throw new Error(`[categories] 未知类目: ${key}`);

  const extractPath = path.join(cfg.baseDir, 'extract.prompt.md');

  const [extractPrompt, designPrompt] = await Promise.all([
    fs.readFile(extractPath, 'utf-8'),
    fs.readFile(cfg.designPromptPath, 'utf-8'),
  ]);

  const loaded: LoadedCategory = {
    meta: cfg.meta,
    schema: cfg.schema,
    extractPrompt,
    designPrompt,
  };
  cache.set(key, loaded);
  return loaded;
}

export function listCategories(): CategoryMeta[] {
  return (Object.keys(registry) as CategoryKey[]).map((k) => registry[k].meta);
}

export function isCategoryKey(s: string): s is CategoryKey {
  return s in registry;
}
