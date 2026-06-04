import 'server-only';
import { completeText, type LLMConfig } from '@/lib/llm';

export type KnowledgeResearchResult = {
  brief: string;
  usage: { input: number; output: number };
};

const KNOWLEDGE_RESEARCH_SYSTEM = `你是知识卡片生成前的研究员。使用横纵分析法做轻量研究，而不是写长报告。

目标：为后续 Bento Grid 知识卡片提供高质量素材。

方法：
1. 识别研究对象类型：概念、技术、公司、产品、人物、事件、争议。
2. 纵向：追溯起源、关键时间节点、阶段变化、历史决策如何塑造今天。
3. 横向：在当前时间截面找同类/竞品/相邻概念，比较差异、生态位、用户或行业选择理由。
4. 交汇：提炼 2-3 个真正有判断力的洞察，不要只是摘要。
5. 证据：优先一手来源；技术/学术对象优先论文、官方文档、GitHub/Release notes；商业对象优先官方公告、财报、权威媒体原创。

如果可用，请联网获取信息；如果联网不可用，明确标注“未联网，仅基于模型已有知识”。不要编造来源 URL。

输出 Markdown，不超过 1200 字，结构固定：

## 研究对象
- 名称：
- 类型：
- 查询意图：

## 信息获取
- 联网状态：
- 关键来源：

## 纵向脉络
- 起源：
- 关键节点：
- 阶段判断：

## 横向截面
- 同类对象：
- 核心差异：
- 生态位：

## 交汇洞察
- 洞察 1：
- 洞察 2：
- 洞察 3：

## 卡片建议
- 推荐主轴：concept | timeline | step | vs
- 推荐模板：α | β | γ | δ | ε
- 必须呈现的数据：
- 风险与不确定性：`;

export async function researchKnowledge(
  input: string,
  llmConfig?: LLMConfig
): Promise<KnowledgeResearchResult> {
  const base = {
    system: KNOWLEDGE_RESEARCH_SYSTEM,
    user: `用户要生成知识类一览图，主题如下：\n${input}`,
    maxTokens: 5000,
    timeoutMs: Number(process.env.LLM_CLAUDE_CLI_RESEARCH_TIMEOUT_MS ?? 240000),
  };

  try {
    const result = await completeText({
      ...base,
      llmConfig,
      tools: process.env.LLM_KNOWLEDGE_RESEARCH_TOOLS ?? 'WebSearch,WebFetch',
      maxTurns: Number(process.env.LLM_KNOWLEDGE_RESEARCH_MAX_TURNS ?? 6),
    });
    return {
      brief: result.text.trim(),
      usage: {
        input: result.usage.prompt_tokens,
        output: result.usage.completion_tokens,
      },
    };
  } catch (err) {
    console.warn('[knowledge.research] web research failed, fallback without tools', err);
    const fallback = await completeText({
      ...base,
      llmConfig,
      system: `${KNOWLEDGE_RESEARCH_SYSTEM}\n\n联网工具不可用时，仍然按横纵分析结构输出，但必须在“联网状态”写明未联网。`,
      tools: '',
    });
    return {
      brief: fallback.text.trim(),
      usage: {
        input: fallback.usage.prompt_tokens,
        output: fallback.usage.completion_tokens,
      },
    };
  }
}
