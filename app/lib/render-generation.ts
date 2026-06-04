import 'server-only';
import { renderStream, type SystemBlock } from '@/lib/llm';
import type { LLMConfig } from '@/lib/llm';
import { getCategory, type CategoryKey } from '@/lib/categories';
import { loadGeneration, saveGenerationHtml } from '@/lib/storage';
import { renderRecipeHtml } from '@/lib/render-recipe';
import { renderKnowledgeHtml } from '@/lib/render-knowledge';
import { renderTravelHtml } from '@/lib/render-travel';

type Usage = {
  input: number;
  output: number;
  cache_read: number;
  cache_creation: number;
};

export type RenderResult = {
  id: string;
  bytes: number;
  truncated: boolean;
  usage: Usage;
};

const COMMON_RENDER_GUARD = `# 输出要求（必读）

- 直接输出完整 HTML，从 \`<!DOCTYPE html>\` 起，到 \`</html>\` 结束，不要 markdown 代码块包裹，不要任何解释文字
- HTML 必须自洽：所有 CSS 内联在 <style>，所有 SVG / 图标内联
- 严格遵守上方 design prompt 的所有约束（画布、Bento 拼贴、字号、禁止项）
- 绝对不要中途截断。如果内容多，请降低装饰复杂度和压缩 CSS，而不是省略核心数据。`;

const KNOWLEDGE_RENDER_GUARD = `${COMMON_RENDER_GUARD}

## 知识类压缩边界

知识类保持单屏 1920×1080，一张图讲清楚。若数据过多，优先合并 sections 和 keyNumbers，但不要破坏 12×6 网格。

## 知识类研究结构（强制）

- 如果数据包含 \`vertical\`、\`horizontal\`、\`insights\`，优先使用横纵研究卡架构：Hero + 关键数字 + 纵向脉络 + 横向截面 + 交汇洞察 + 来源/置信度。
- \`insights[].claim\` 至少展示 1 条，不能全部丢弃。
- \`vertical.phases\` 可压缩成 timeline/阶段脊柱，但不能只写“发展历程”四个字。
- \`horizontal.contrasts\` 可压缩成对比卡，但必须呈现本对象与同类的差异。
- \`sources\` 和 \`confidence\` 可以做小卡，不要让来源占主视觉。`;

const TRAVEL_RENDER_GUARD = `${COMMON_RENDER_GUARD}

## 旅游类长行程规则（强制）

- 旅游类不再受 1920×1080 高度限制。宽度固定 1920px，高度可以按内容向下延伸。
- 若 \`days.length > 6\`，仍然必须一天一个 day-card，不能合并为 stage，不能省略日期。
- 每个 day-card 必须展示当天主题、行车段（from/to/距离/时长/亮点）和 3-5 个 stops。
- \`hotels\` 必须展开展示，不能写“等 N 家”、不能只挑代表酒店。酒店多时使用 hotel-grid 或 hotel-list 纵向排布。
- long road-trip 推荐结构：顶部 1920×1080 hero overview + 下方按 3 列或 2 列继续排满每日卡片 + 住宿清单区。
- 页面可滚动：\`html, body { min-height: 100%; overflow: auto; }\`。不要给 body 设置 \`overflow:hidden\`。
- \`.canvas\` 可使用 \`width: 1920px; min-height: 1080px; height: auto;\`。预览缩放仍可保留，但 snapshot 模式必须恢复原尺寸和自然高度。

## 卫星主图规则（强制）

- road-trip 的主图优先使用卫星图，不要用纯 SVG 插画替代。
- 可以使用无需 key 的 ESRI World Imagery 导出图作为底图，例如：
  \`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=73,34,96,49&bboxSR=4326&imageSR=4326&size=1280,640&format=jpg&f=image\`
- 新疆自驾可用 bbox \`73,34,96,49\`；川西可用 \`97,27,105,34\`；云南可用 \`97,21,107,30\`。其他目的地可按地理范围估计 bbox。
- 卫星图用 \`<img>\` 做底图，上层叠加 SVG 路线、markers、day 图例和半透明信息面板。
- 除卫星底图外，不要引入其他外部图片、脚本或字体。`;

function renderGuardFor(categoryKey: CategoryKey): string {
  return categoryKey === 'travel' ? TRAVEL_RENDER_GUARD : KNOWLEDGE_RENDER_GUARD;
}

export function htmlSanitize(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
}

export function stripFence(html: string): string {
  const trimmed = html.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

export async function renderGeneration(
  id: string,
  categoryKey: CategoryKey,
  llmConfig?: LLMConfig,
  onChunk?: (chunk: string, total: number) => void
): Promise<RenderResult> {
  const generation = await loadGeneration(id);
  if (generation.categoryKey !== categoryKey) {
    throw new Error(
      `categoryKey 与存储记录不符：want ${generation.categoryKey}, got ${categoryKey}`
    );
  }

  if (categoryKey === 'recipe') {
    const cleanHtml = renderRecipeHtml(generation.data);
    onChunk?.(cleanHtml, cleanHtml.length);
    await saveGenerationHtml(id, cleanHtml);
    return {
      id,
      bytes: cleanHtml.length,
      truncated: false,
      usage: {
        input: 0,
        output: 0,
        cache_read: 0,
        cache_creation: 0,
      },
    };
  }

  if (categoryKey === 'knowledge' || categoryKey === 'travel') {
    const cleanHtml =
      categoryKey === 'knowledge'
        ? renderKnowledgeHtml(generation.data)
        : renderTravelHtml(generation.data);
    onChunk?.(cleanHtml, cleanHtml.length);
    await saveGenerationHtml(id, cleanHtml);
    return {
      id,
      bytes: cleanHtml.length,
      truncated: false,
      usage: {
        input: 0,
        output: 0,
        cache_read: 0,
        cache_creation: 0,
      },
    };
  }

  const category = await getCategory(categoryKey);
  const systemBlocks: SystemBlock[] = [
    {
      type: 'text',
      text: category.designPrompt,
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: renderGuardFor(categoryKey) },
  ];

  const userPayload = `下面是要渲染的数据 JSON：\n\n${JSON.stringify(
    generation.data,
    null,
    2
  )}`;

  const { textStream, final } = renderStream({
    systemBlocks,
    user: userPayload,
    llmConfig,
    maxTokens: categoryKey === 'travel' ? 30000 : 16000,
  });

  let received = 0;
  try {
    for await (const chunk of textStream) {
      if (typeof chunk === 'string' && chunk.length > 0) {
        received += chunk.length;
        onChunk?.(chunk, received);
      }
    }
  } catch (err) {
    await final.catch(() => undefined);
    throw err;
  }

  const { html: rawHtml, usage } = await final;
  const cleanHtml = htmlSanitize(stripFence(rawHtml));
  await saveGenerationHtml(id, cleanHtml);

  return {
    id,
    bytes: cleanHtml.length,
    truncated: !/<\/html\s*>\s*$/i.test(cleanHtml.trim()),
    usage: {
      input: usage.prompt_tokens,
      output: usage.completion_tokens,
      cache_read: usage.prompt_cache_hit_tokens ?? 0,
      cache_creation: usage.prompt_cache_miss_tokens ?? 0,
    },
  };
}
