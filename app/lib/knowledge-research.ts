import 'server-only';
import {
  completeText,
  normalizeLLMConfig,
  type LLMConfig,
} from '@/lib/llm';

export type KnowledgeResearchResult = {
  brief: string;
  usage: { input: number; output: number };
  webVerified: boolean;
  researchedAt?: string;
};

function dateContext() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    date,
    isoDate: now.toISOString().slice(0, 10),
  };
}

function webResearchConfig(selected?: LLMConfig): LLMConfig {
  const resolved = normalizeLLMConfig(selected);
  if (resolved.provider === 'claude-cli') return resolved;
  return {
    provider: 'claude-cli',
    model:
      process.env.LLM_KNOWLEDGE_RESEARCH_MODEL ??
      process.env.LLM_MODEL_CHAT ??
      'claude-sonnet-4-6',
    baseUrl: '',
  };
}

function assertWebResearch(result: Awaited<ReturnType<typeof completeText>>) {
  const text = result.text.trim();
  if (
    (result.usage.permission_denials ?? 0) > 0 ||
    /网络访问工具未获授权|无法执行实时联网检索|未联网，仅基于模型已有知识/i.test(
      text
    ) ||
    !/https?:\/\/\S+/i.test(text)
  ) {
    throw new Error('[knowledge.research] web tools returned no verified results');
  }
}

function researchSystem(currentDate: string) {
  return `你是知识卡片生成前的研究员。使用横纵分析法做轻量研究，而不是写长报告。

目标：为后续 Bento Grid 知识卡片提供高质量素材。

当前日期：${currentDate}（Asia/Shanghai）。你的训练知识不能作为“最新”依据，所有当前状态和近况必须通过联网检索确认。

方法：
1. 识别研究对象类型：概念、技术、公司、产品、人物、事件、争议。
2. 纵向：追溯起源、关键时间节点、阶段变化、历史决策如何塑造今天。
3. 横向：在当前时间截面找同类/竞品/相邻概念，比较差异、生态位、用户或行业选择理由。
4. 交汇：提炼 2-3 个真正有判断力的洞察，不要只是摘要。
5. 证据：优先一手来源；技术/学术对象优先论文、官方文档、GitHub/Release notes；商业对象优先官方公告、财报、权威媒体原创。

时效性规则：
- 最多执行 2 次搜索：第一次查“研究对象 + latest / 最新 / 2026”，第二次只用于补充缺失信息。
- 从搜索结果中打开 2-3 个最相关的一手来源核验；获得足够事实后立即停止检索并输出，不要继续扩展搜索。
- 先确认截至 ${currentDate} 的最新版本、最新事件、最新数据或当前竞争格局，再回溯历史。
- 列出 2 条最近 12 个月最重要的更新；确实没有更新时，明确写“最近 12 个月未发现可靠重大更新”。
- 区分事件发生日期与网页发布日期；发生日期优先。
- 搜索结果摘要只能用于发现线索，关键事实必须打开来源核验。
- 如果不同来源冲突，采用日期更近的一手来源，并在风险项说明差异。
- 禁止把“2023+”“近年来”“目前”等模糊时间当作最新节点；使用具体年月或日期。

内容去重规则：
- 同一事实只记录在最合适的栏目一次，不要在“关键节点、阶段判断、核心差异、洞察”中反复改写。
- 纵向提供时间与因果，横向提供差异与选择，交汇洞察必须连接至少一条纵向事实和一条横向事实。
- 每条洞察承担不同任务：因果解释、核心矛盾、未来推演、选择建议，最多各一条。
- “卡片建议”的必须呈现数据只列事实名称，不复述前文句子。

如果可用，请联网获取信息；如果联网不可用，明确标注“未联网，仅基于模型已有知识”。不要编造来源 URL。

输出 Markdown，不超过 900 字，结构固定：

## 研究对象
- 名称：
- 类型：
- 查询意图：

## 信息获取
- 联网状态：
- 检索截止：${currentDate}
- 最新可靠信息日期：
- 关键来源（标题｜发布方｜发布日期｜URL）：

## 最近更新
- 更新 1（日期｜事件｜影响｜来源 URL）：
- 更新 2（日期｜事件｜影响｜来源 URL）：

## 纵向脉络
- 起源：
- 关键节点：
- 阶段判断：

## 横向截面
- 同类对象：
- 核心差异：
- 生态位：

## 交汇洞察
- 因果洞察：
- 矛盾洞察：
- 推演或选择洞察：

## 卡片建议
- 推荐主轴：concept | timeline | step | vs
- 推荐模板：α | β | γ | δ | ε
- 必须呈现的数据：
- 风险与不确定性：`;
}

export async function researchKnowledge(
  input: string,
  llmConfig?: LLMConfig
): Promise<KnowledgeResearchResult> {
  const { date, isoDate } = dateContext();
  const system = researchSystem(date);
  const base = {
    system,
    user: `用户要生成知识类一览图。请先检索截至 ${isoDate} 的最新信息，再研究以下主题：\n${input}`,
    maxTokens: 3000,
    timeoutMs: Number(process.env.LLM_CLAUDE_CLI_RESEARCH_TIMEOUT_MS ?? 180000),
  };

  try {
    const result = await completeText({
      ...base,
      llmConfig: webResearchConfig(llmConfig),
      tools: process.env.LLM_KNOWLEDGE_RESEARCH_TOOLS ?? 'WebSearch,WebFetch',
      maxTurns: Number(process.env.LLM_KNOWLEDGE_RESEARCH_MAX_TURNS ?? 6),
      permissionMode: 'bypassPermissions',
    });
    assertWebResearch(result);
    return {
      brief: result.text.trim(),
      usage: {
        input: result.usage.prompt_tokens,
        output: result.usage.completion_tokens,
      },
      webVerified: true,
      researchedAt: isoDate,
    };
  } catch (err) {
    console.warn('[knowledge.research] web research failed', err);
    if (process.env.KNOWLEDGE_ALLOW_OFFLINE_FALLBACK !== 'true') {
      throw new Error(
        `知识类联网研究失败，已停止生成以避免输出过时信息：${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    const fallback = await completeText({
      ...base,
      llmConfig,
      system: `${system}\n\n联网工具不可用。仍然按横纵分析结构输出，但必须在“联网状态”写明未联网，并且不要声称任何信息是截至 ${date} 的最新状态。`,
      tools: '',
      timeoutMs: Number(process.env.LLM_KNOWLEDGE_FALLBACK_TIMEOUT_MS ?? 90000),
    });
    return {
      brief: fallback.text.trim(),
      usage: {
        input: fallback.usage.prompt_tokens,
        output: fallback.usage.completion_tokens,
      },
      webVerified: false,
    };
  }
}

export function enforceKnowledgeFreshness(
  data: unknown,
  research: KnowledgeResearchResult
): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const result = { ...(data as Record<string, unknown>) };
  if (research.webVerified) {
    result.researchedAt = research.researchedAt;
  } else {
    delete result.researchedAt;
    delete result.latestUpdates;
  }
  return result;
}
