import { z } from 'zod';

const accentEnum = z.enum([
  '#0071E3',
  '#FF6B35',
  '#34C759',
  '#AF52DE',
  '#FF3B30',
]);

const sourceSchema = z.object({
  title: z.string().min(2).max(60),
  publisher: z.string().max(40).optional(),
  url: z.string().max(240).optional(),
  note: z.string().max(80).optional(),
});

const knowledgeImageSchema = z.object({
  title: z.string().min(1).max(140),
  caption: z.string().max(160).optional(),
  imageUrl: z.string().max(240),
  source: z.string().max(80).optional(),
  license: z.string().max(80).optional(),
  sourceUrl: z.string().max(500).optional(),
  kind: z.enum(['web', 'ai']).default('web'),
});

export const knowledgeSchema = z.object({
  title: z.string().min(2).max(40),
  subtitle: z.string().max(120).optional(),
  subjectType: z
    .enum(['concept', 'technology', 'company', 'product', 'person', 'event', 'debate'])
    .optional(),
  contentAxis: z
    .enum(['concept', 'timeline', 'step', 'vs'])
    .optional()
    .describe('从横纵研究后确定的卡片主轴。'),

  keyMessage: z
    .string()
    .min(8)
    .max(180)
    .describe(
      '核心一句话观点。可在 1-3 个关键词上加 <span class="acc">…</span> 表示 accent 高亮。'
    ),

  takeaway: z.string().min(8).max(220),

  keyNumbers: z
    .array(
      z.object({
        label: z.string().min(2).max(32),
        value: z.string().min(1).max(24),
        unit: z.string().max(10).optional(),
        description: z.string().min(2).max(80),
      })
    )
    .min(2)
    .max(6),

  sections: z
    .array(
      z.object({
        heading: z.string().min(2).max(28),
        body: z.string().min(4).max(260),
      })
    )
    .min(2)
    .max(6),

  vertical: z
    .object({
      origin: z.string().min(4).max(180),
      phases: z
        .array(
          z.object({
            label: z.string().min(2).max(28),
            period: z.string().max(28).optional(),
            point: z.string().min(4).max(140),
          })
        )
        .min(2)
        .max(4),
    })
    .optional()
    .describe('纵向脉络：起源、阶段、历史决策。'),

  horizontal: z
    .object({
      peers: z.array(z.string().min(1).max(40)).min(1).max(6),
      contrasts: z
        .array(
          z.object({
            dimension: z.string().min(2).max(32),
            subject: z.string().min(2).max(100),
            peers: z.string().min(2).max(140),
          })
        )
        .min(1)
        .max(4),
      position: z.string().min(4).max(180),
    })
    .optional()
    .describe('横向截面：同类对象、差异、生态位。'),

  insights: z
    .array(
      z.object({
        claim: z.string().min(4).max(90),
        evidence: z.string().min(4).max(160),
      })
    )
    .min(2)
    .max(4)
    .optional()
    .describe('横纵交汇后的关键判断，不是普通摘要。'),

  timeline: z
    .array(
      z.object({
        year: z.string().min(1).max(24),
        event: z.string().min(2).max(80),
      })
    )
    .min(3)
    .max(4)
    .optional()
    .describe('内容形态是「时间脉络」时给出，最多 4 个关键节点，配 Template δ 脊柱'),

  steps: z
    .array(
      z.object({
        index: z.number().int().min(1).max(12),
        title: z.string().min(2).max(28),
        description: z.string().min(4).max(100),
      })
    )
    .min(3)
    .max(5)
    .optional()
    .describe('内容形态是「步骤 / 流程」时给出，最多 5 步，配 Template δ 脊柱'),

  comparisons: z
    .array(
      z.object({
        topic: z.string().min(2).max(32),
        a: z.object({ label: z.string().max(48), value: z.string().max(100) }),
        b: z.object({ label: z.string().max(48), value: z.string().max(100) }),
      })
    )
    .min(1)
    .max(4)
    .optional()
    .describe('内容形态是「对决 / vs」时给出，配 Template ε'),

  entities: z
    .array(
      z.object({
        name: z.string().min(1).max(32),
        role: z.string().min(2).max(80),
      })
    )
    .min(2)
    .max(8)
    .optional()
    .describe('涉及的关键人物 / 公司 / 流派'),

  quote: z
    .object({
      text: z.string().min(6).max(220),
      source: z.string().min(2).max(80),
    })
    .optional(),

  sources: z.array(sourceSchema).max(6).optional(),
  images: z.array(knowledgeImageSchema).max(4).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),

  accent: accentEnum.describe(
    '主题色：科技/商业=蓝；能量/突破=橙；自然/增长=绿；创意/文化=紫；风险/警示=红。'
  ),
});

export type KnowledgeData = z.infer<typeof knowledgeSchema>;
