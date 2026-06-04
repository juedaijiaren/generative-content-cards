# Recipe Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recipe category to the existing generator, using structured recipe JSON and a local Xiaohongshu v2 renderer.

**Architecture:** Keep knowledge and travel unchanged. Add recipe schema/extract/meta files, register `recipe`, expose it in the home UI, and route recipe rendering through a deterministic local HTML renderer instead of asking the LLM to write HTML.

**Tech Stack:** Next.js 16, TypeScript, Zod, local HTML string renderer.

---

### Task 1: Category Contract

**Files:**
- Modify: `app/lib/categories-types.ts`
- Create: `app/categories/recipe/meta.ts`
- Create: `app/categories/recipe/schema.ts`
- Create: `app/categories/recipe/extract.prompt.md`

- [ ] Add `recipe` to `CategoryKey`.
- [ ] Define recipe metadata.
- [ ] Define Zod schema for dish name, servings, difficulty, ingredients, seasonings, process images, steps, tips.
- [ ] Define extract prompt that outputs only JSON.

### Task 2: Register Category And UI

**Files:**
- Modify: `app/lib/categories.ts`
- Modify: `app/app/page.tsx`

- [ ] Import recipe metadata/schema.
- [ ] Add design prompt path `../食谱类/design.prompt.md`.
- [ ] Add recipe button and placeholder in UI.

### Task 3: Local Recipe Renderer

**Files:**
- Create: `app/lib/render-recipe.ts`
- Modify: `app/lib/render-generation.ts`

- [ ] Create safe escaping helpers.
- [ ] Render recipe data as Xiaohongshu v2 long-form HTML.
- [ ] Use local renderer when `categoryKey === "recipe"`.

### Task 4: Verify

**Commands:**
- `pnpm typecheck`
- `pnpm lint`

- [ ] Fix type/lint issues.
