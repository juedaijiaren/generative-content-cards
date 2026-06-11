import 'server-only';
import { knowledgeSchema, type KnowledgeData } from '@/categories/knowledge/schema';

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeRich(value: string): string {
  return esc(value)
    .replaceAll('&lt;span class=&quot;acc&quot;&gt;', '<span class="acc">')
    .replaceAll('&lt;/span&gt;', '</span>');
}

function take<T>(items: T[] | undefined, count: number): T[] {
  return (items ?? []).slice(0, count);
}

const sectionRoleLabel = {
  mechanism: '运作机制',
  'turning-point': '关键转折',
  application: '应用条件',
  controversy: '争议边界',
  comparison: '关键差异',
  implication: '影响判断',
} as const;

const insightTypeLabel = {
  causal: '因果推导',
  tension: '核心矛盾',
  prediction: '未来推演',
  decision: '选择建议',
} as const;

function insightCards(data: KnowledgeData) {
  return take(data.insights, 4).map(
      (item) => `<div class="card insight">
        <div class="label">${esc(
          item.type ? insightTypeLabel[item.type] : '交汇洞察'
        )}</div>
        <h3>${esc(item.claim)}</h3>
        <p>${esc(item.evidence)}</p>
      </div>`
    );
}

function metricCards(data: KnowledgeData) {
  return take(data.keyNumbers, 5).map((item) => ({
    label: item.label,
    value: item.value,
    unit: item.unit,
    description: item.description,
  }));
}

function timelineHtml(data: KnowledgeData) {
  const explicitTimeline = take(data.timeline, 4);
  const verticalTimeline =
    data.vertical?.phases.map((phase) => ({
      year: phase.period ?? phase.label,
      event: phase.point,
    })) ?? [];
  const items = explicitTimeline.length
    ? explicitTimeline
    : verticalTimeline.length
    ? verticalTimeline.slice(0, 4)
    : take(data.sections, 4).map((section, index) => ({
        year: `0${index + 1}`,
        event: section.heading,
      }));

  return items
    .map(
      (item) => `<div class="stop">
        <b>${esc(item.year)}</b>
        <span>${esc(item.event)}</span>
      </div>`
    )
    .join('');
}

function compareHtml(data: KnowledgeData) {
  const contrasts = take(data.horizontal?.contrasts, 3);
  if (contrasts.length > 0) {
    return contrasts
      .map(
        (item) => `<div class="compare-row">
          <b>${esc(item.dimension)}</b>
          <span>${esc(item.subject)}</span>
          <em>${esc(item.peers)}</em>
        </div>`
      )
      .join('');
  }

  return take(data.comparisons, 3)
    .map(
      (item) => `<div class="compare-row">
        <b>${esc(item.topic)}</b>
        <span>${esc(item.a.label)}：${esc(item.a.value)}</span>
        <em>${esc(item.b.label)}：${esc(item.b.value)}</em>
      </div>`
    )
    .join('');
}

function sectionsHtml(data: KnowledgeData) {
  return data.sections
    .map(
      (section, index) => `<article class="detail-card">
        <div class="detail-index">${String(index + 1).padStart(2, '0')}</div>
        <div>
          ${
            section.role
              ? `<div class="detail-role">${esc(sectionRoleLabel[section.role])}</div>`
              : ''
          }
          <h3>${esc(section.heading)}</h3>
          <p>${esc(section.body)}</p>
        </div>
      </article>`
    )
    .join('');
}

function stepsHtml(data: KnowledgeData) {
  return (data.steps ?? [])
    .map(
      (step) => `<article class="step-card">
        <div class="step-index">${esc(step.index)}</div>
        <div>
          <h3>${esc(step.title)}</h3>
          <p>${esc(step.description)}</p>
        </div>
      </article>`
    )
    .join('');
}

function latestUpdatesHtml(data: KnowledgeData) {
  return (data.latestUpdates ?? [])
    .map(
      (item) => `<article class="update-card">
        <time>${esc(item.date)}</time>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.detail)}</p>
        ${
          item.sourceUrl
            ? `<a href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">${esc(
                item.sourceTitle ?? '查看来源'
              )}</a>`
            : item.sourceTitle
              ? `<span>${esc(item.sourceTitle)}</span>`
              : ''
        }
      </article>`
    )
    .join('');
}

function verticalHtml(data: KnowledgeData) {
  const phases = data.vertical?.phases ?? [];
  if (!phases.length) return timelineHtml(data);
  return phases
    .map(
      (phase) => `<div class="phase">
        <strong>${esc(phase.period ?? phase.label)}</strong>
        <h3>${esc(phase.label)}</h3>
        <p>${esc(phase.point)}</p>
      </div>`
    )
    .join('');
}

function entitiesHtml(data: KnowledgeData) {
  return (data.entities ?? [])
    .map(
      (entity) => `<div class="entity">
        <b>${esc(entity.name)}</b>
        <span>${esc(entity.role)}</span>
      </div>`
    )
    .join('');
}

function visualHtml(data: KnowledgeData) {
  const image = data.images?.[0];
  if (!image) return '';
  return `<figure class="visual-card">
    <img src="${esc(image.imageUrl)}" alt="${esc(image.title)}">
    <figcaption>
      <b>${esc(image.title)}</b>
      <span>${esc(image.caption ?? image.source ?? '')}</span>
    </figcaption>
  </figure>`;
}

function imageCredits(data: KnowledgeData) {
  const images = data.images ?? [];
  if (!images.length) return '';
  return ` · 图片：${esc(
    images
      .map((image) => `${image.source ?? image.title}${image.license ? ` / ${image.license}` : ''}`)
      .slice(0, 3)
      .join(' · ')
  )}`;
}

function summaryCards(data: KnowledgeData, limit = 2) {
  const candidates = [
    { label: 'POSITION', text: data.horizontal?.position },
    { label: 'ORIGIN', text: data.vertical?.origin },
    { label: 'CONTEXT', text: data.subtitle },
  ];
  const seen = new Set<string>();
  return candidates
    .filter((item): item is { label: string; text: string } => Boolean(item.text))
    .filter((item) => {
      const key = item.text.replace(/\s+/g, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(
      (item) => `<div class="summary-card">
        <div class="label">${item.label}</div>
        <p>${esc(item.text)}</p>
      </div>`
    )
    .join('');
}

function analysisHtml(data: KnowledgeData) {
  const blocks: string[] = [];
  if (data.vertical?.phases.length || data.timeline?.length) {
    blocks.push(`<div>
      <div class="section-title"><h2>${
        data.contentAxis === 'timeline' ? '关键转折' : '纵向脉络'
      }</h2><p>关键节点如何一步步塑造今天。</p></div>
      <div class="phase-grid">${verticalHtml(data)}</div>
    </div>`);
  }
  if (data.horizontal?.contrasts.length || data.comparisons?.length) {
    blocks.push(`<div>
      <div class="section-title"><h2>${
        data.contentAxis === 'vs' ? '选择维度' : '横向对比'
      }</h2><p>比较差异、适用条件与选择理由。</p></div>
      <div class="compare">${compareHtml(data)}</div>
    </div>`);
  }
  if (!blocks.length) return '';
  return `<section class="analysis-grid ${blocks.length === 1 ? 'single' : ''}">
    ${blocks.join('')}
  </section>`;
}

export function renderKnowledgeHtml(rawData: unknown): string {
  const data = knowledgeSchema.parse(rawData);
  const accent = data.accent;
  const numbers = metricCards(data);
  const insights = insightCards(data);
  const analysis = analysisHtml(data);
  const visual = visualHtml(data);
  const summaries = summaryCards(data, visual ? 1 : 2);
  const summaryContent = `${visual}${summaries}`;
  const sourceText =
    data.sources?.map((source) => source.publisher || source.title).slice(0, 3).join(' · ') ||
    '基于结构化研究素材';

  return `<!DOCTYPE html>
<!-- category: knowledge · template: local-long-v2 -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(data.title)} 一览图</title>
<style>
*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:#e5e5ea;font-family:-apple-system,"PingFang SC","SF Pro Display","Noto Sans SC",sans-serif;color:#1d1d1f}body{position:relative}.canvas{--accent:${accent};--scale:min(calc(100vw / 1920px),calc(100vh / 1080px));position:absolute;top:0;left:0;width:1920px;min-height:1080px;height:auto;padding:34px;background:#fff;transform-origin:0 0;transform:translateX(calc((100vw - 1920px * var(--scale))/2)) scale(var(--scale))}body.snapshot .canvas{transform:none;position:static}.label{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6e6e73;font-weight:800}.card,.detail-card,.phase,.entity,.step-card,.update-card{background:#f2f2f4;border-radius:22px;padding:24px;position:relative}.hero-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:start}.hero-grid.solo{grid-template-columns:1fr}.hero{background:#fff;border:1px solid #e5e5ea;padding:38px}.hero h1{margin:12px 0 18px;font-size:54px;line-height:1;font-weight:800}.hero .message{font-size:66px;line-height:1.08;font-weight:850;letter-spacing:0}.acc{color:var(--accent)}.takeaway{margin-top:34px;padding-top:24px;border-top:1px solid #d9d9de;color:#555}.takeaway .label{margin-bottom:10px;color:var(--accent)}.takeaway p{max-width:900px;margin:0;font-size:25px;line-height:1.45;font-weight:650}.summary{display:grid;gap:18px;align-content:start}.summary-card{min-height:170px;background:#1d1d1f;color:#fff;border-radius:22px;padding:28px;display:flex;flex-direction:column;justify-content:space-between}.summary-card .label{color:rgba(255,255,255,.62)}.summary-card p{font-size:24px;line-height:1.42;margin:18px 0 0;color:rgba(255,255,255,.82);font-weight:650}.visual-card{height:300px;margin:0;border-radius:22px;overflow:hidden;background:#111;color:#fff;position:relative}.visual-card img{width:100%;height:100%;object-fit:cover;display:block}.visual-card::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.72))}.visual-card figcaption{position:absolute;left:22px;right:22px;bottom:20px;z-index:1}.visual-card b{display:block;font-size:22px;margin-bottom:7px}.visual-card span{display:block;color:rgba(255,255,255,.78);font-size:15px;line-height:1.35}.section-title{margin:34px 0 16px;display:flex;align-items:end;justify-content:space-between;gap:24px}.section-title h2{font-size:38px;margin:0}.section-title p{margin:0;color:#777;font-size:18px;font-weight:700}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.num{min-height:210px;display:flex;flex-direction:column;gap:10px}.num strong{font-size:68px;line-height:.95;color:var(--accent);font-weight:600;letter-spacing:0}.num span{font-size:22px;color:#6e6e73}.num p{margin:auto 0 0;color:#333;font-size:19px;line-height:1.4;font-weight:700}.updates{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.update-card{background:#111;color:#fff;min-height:190px}.update-card time{display:block;color:#9ac7ff;font-size:15px;font-weight:800;margin-bottom:12px}.update-card h3{font-size:25px;line-height:1.2;margin:0 0 10px}.update-card p{margin:0;color:rgba(255,255,255,.75);font-size:17px;line-height:1.45}.update-card a,.update-card span{display:inline-block;margin-top:14px;color:#9ac7ff;font-size:14px;text-decoration:none}.analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.analysis-grid.single{grid-template-columns:1fr}.timeline,.compare{display:grid;gap:12px}.stop,.compare-row{background:#fff;border-radius:16px;padding:16px}.stop b{display:block;color:var(--accent);font-size:24px;margin-bottom:8px}.stop span{font-size:18px;line-height:1.38;color:#4d4d52}.compare-row{display:grid;grid-template-columns:150px 1fr 1fr;gap:16px;align-items:start}.compare-row b{color:var(--accent);font-size:17px}.compare-row span,.compare-row em{font-style:normal;font-size:16px;line-height:1.38;color:#4b4b50}.detail-grid,.steps-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.detail-card,.step-card{display:grid;grid-template-columns:56px 1fr;gap:18px;background:#fff;border:1px solid #e5e5ea}.detail-index,.step-index{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:#fff;font-weight:800}.detail-role{color:var(--accent);font-size:13px;font-weight:800;margin-bottom:7px}.detail-card h3,.step-card h3,.phase h3,.insight h3{font-size:27px;line-height:1.18;margin:0 0 12px}.detail-card p,.step-card p,.phase p,.insight p{margin:0;color:#56565c;font-size:18px;line-height:1.48}.phase-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.analysis-grid .phase-grid{grid-template-columns:repeat(2,1fr)}.analysis-grid.single .phase-grid{grid-template-columns:repeat(4,1fr)}.phase strong{display:block;color:var(--accent);font-size:28px;margin-bottom:10px}.insights{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.insight:nth-child(3),.insight:nth-child(4){background:#1d1d1f;color:#fff}.insight:nth-child(3) .label,.insight:nth-child(4) .label,.insight:nth-child(3) p,.insight:nth-child(4) p{color:rgba(255,255,255,.72)}.entities{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.entity{padding:18px;background:#fff;border:1px solid #e5e5ea}.entity b{display:block;font-size:18px;color:#1d1d1f;margin-bottom:8px}.entity span{display:block;color:#606066;font-size:15px;line-height:1.35}.source{margin-top:28px;color:#8a8a8e;font-size:15px;text-align:right}
</style>
</head>
<body>
<main class="canvas">
  <section class="hero-grid ${summaryContent ? '' : 'solo'}">
    <div class="card hero">
      <div class="label">${esc(data.subjectType ?? data.contentAxis ?? 'knowledge')}</div>
      <h1>${esc(data.title)}</h1>
      <div class="message">${safeRich(data.keyMessage)}</div>
      <div class="takeaway">
        <div class="label">一句话启发</div>
        <p>${esc(data.takeaway)}</p>
      </div>
    </div>
    ${summaryContent ? `<div class="summary">${summaryContent}</div>` : ''}
  </section>

  <section>
    <div class="section-title"><h2>关键数字</h2><p>用数字建立主题的量级与时间坐标。</p></div>
    <div class="metrics" style="grid-template-columns:repeat(${numbers.length},1fr)">${numbers
      .map(
        (item) => `<section class="card num">
      <div class="label">${esc(item.label)}</div>
      <strong>${esc(item.value)}</strong>${item.unit ? `<span>${esc(item.unit)}</span>` : ''}
      <p>${esc(item.description)}</p>
    </section>`
      )
      .join('')}</div>
  </section>

  ${
    data.latestUpdates?.length
      ? `<section>
    <div class="section-title"><h2>最近更新</h2><p>检索截至 ${esc(
      data.researchedAt ?? '最近一次联网研究'
    )}。</p></div>
    <div class="updates">${latestUpdatesHtml(data)}</div>
  </section>`
      : ''
  }

  ${
    data.steps?.length
      ? `<section>
    <div class="section-title"><h2>执行路径</h2><p>每一步都有明确目标与检查标准。</p></div>
    <div class="steps-grid">${stepsHtml(data)}</div>
  </section>`
      : ''
  }

  ${analysis}

  <section>
    <div class="section-title"><h2>深度解读</h2><p>从机制、转折、应用与边界理解主题。</p></div>
    <div class="detail-grid">${sectionsHtml(data)}</div>
  </section>

  ${
    insights.length
      ? `<section>
    <div class="section-title"><h2>交汇洞察</h2><p>由历史路径与当下格局推导出的判断。</p></div>
    <div class="insights">${insights.join('')}</div>
  </section>`
      : ''
  }

  ${
    data.entities?.length
      ? `<section>
    <div class="section-title"><h2>关键实体</h2><p>人物、公司、框架与协议。</p></div>
    <div class="entities">${entitiesHtml(data)}</div>
  </section>`
      : ''
  }
  <div class="source">来源：${esc(sourceText)} · 置信度：${esc(
    data.confidence ?? 'medium'
  )}${data.researchedAt ? ` · 检索截至：${esc(data.researchedAt)}` : ''}${imageCredits(data)}</div>
</main>
</body>
</html>`;
}
