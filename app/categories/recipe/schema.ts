import { z } from 'zod';

const qty = z.string().min(1).max(24);

const ingredientSchema = z.object({
  name: z.string().min(1).max(30),
  amount: qty,
  group: z.string().max(20).optional(),
  note: z.string().max(60).optional(),
});

const processImageSchema = z.object({
  stage: z.string().min(2).max(28),
  title: z.string().min(2).max(28),
  description: z.string().min(4).max(120),
  checkPoint: z.string().min(4).max(120),
  imageUrl: z.string().max(500).optional(),
});

const stepSchema = z.object({
  index: z.number().int().min(1).max(24),
  title: z.string().min(2).max(32),
  duration: z.string().min(1).max(24),
  description: z.string().min(4).max(180),
});

export const recipeSchema = z.object({
  dishName: z.string().min(2).max(40),
  subtitle: z.string().min(4).max(100),
  servings: z.string().min(1).max(24),
  difficulty: z.enum(['简单', '中等', '进阶']),
  summary: z.string().min(12).max(180),
  heroImageUrl: z.string().max(500).optional(),
  heroImagePrompt: z.string().max(500).optional(),
  ingredients: z.array(ingredientSchema).min(2).max(24),
  seasonings: z.array(ingredientSchema).min(1).max(18),
  successKeys: z.array(z.string().min(4).max(80)).min(2).max(4),
  warnings: z.array(z.string().min(4).max(80)).min(2).max(4),
  processImages: z.array(processImageSchema).min(2).max(6),
  steps: z.array(stepSchema).min(3).max(18),
  timeChecks: z
    .array(
      z.object({
        label: z.string().min(2).max(28),
        duration: z.string().min(1).max(24),
        check: z.string().min(4).max(100),
      })
    )
    .min(2)
    .max(6),
  tips: z.array(z.string().min(4).max(100)).min(2).max(4),
});

export type RecipeData = z.infer<typeof recipeSchema>;
