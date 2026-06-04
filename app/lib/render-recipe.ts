import 'server-only';
import { recipeSchema, type RecipeData } from '@/categories/recipe/schema';

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attr(value: unknown): string {
  return esc(value).replaceAll('\n', ' ');
}

function groups(items: RecipeData['ingredients']): Record<string, RecipeData['ingredients']> {
  return items.reduce<Record<string, RecipeData['ingredients']>>((acc, item) => {
    const key = item.group?.trim() || '食材';
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function listRows(items: RecipeData['ingredients']) {
  return items
    .map(
      (item) =>
        `<div class="row"><span>${esc(item.name)}</span><em>${esc(item.amount)}</em></div>`
    )
    .join('');
}

function imageOrPlaceholder(imageUrl: string | undefined, title: string, label: string) {
  if (imageUrl) {
    return `<img src="${attr(imageUrl)}" alt="${attr(title)}">`;
  }
  return `<div class="image-placeholder"><strong>${esc(label)}</strong><span>${esc(title)}</span></div>`;
}

function renderIngredientGroups(data: RecipeData) {
  const merged = groups([
    ...data.ingredients.map((item) => ({ ...item, group: item.group || '主料' })),
    ...data.seasonings.map((item) => ({ ...item, group: item.group || '调料' })),
  ]);

  return Object.entries(merged)
    .slice(0, 8)
    .map(
      ([group, items]) => `<div class="group">
        <h3>${esc(group)}</h3>
        ${listRows(items.slice(0, 8))}
      </div>`
    )
    .join('');
}

export function renderRecipeHtml(rawData: unknown): string {
  const data = recipeSchema.parse(rawData);
  const process = data.processImages.slice(0, 6);
  const steps = data.steps.slice(0, 18);
  const timeChecks = data.timeChecks.slice(0, 6);
  const tips = data.tips.slice(0, 4);

  return `<!DOCTYPE html>
<!-- category: recipe · template: xiaohongshu-v2 · renderer: local-v1 -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(data.dishName)}菜谱</title>
<style>
*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:#eadfd4;font-family:-apple-system,"PingFang SC","SF Pro Display","Noto Sans SC",sans-serif;color:#40251c}body{position:relative}.viewport{min-height:100vh;position:relative}.canvas{--scale:min(calc(100vw / 1920px),calc(100vh / 1080px));--red:#d94d2b;--ink:#40251c;--muted:#8f6555;position:absolute;top:0;left:0;width:1920px;min-height:1080px;height:auto;padding:34px;background:radial-gradient(circle at 8% 7%,rgba(255,223,176,.9),transparent 280px),radial-gradient(circle at 95% 4%,rgba(255,173,141,.45),transparent 330px),linear-gradient(135deg,#fff7e9 0%,#f9e6d5 55%,#f6d3c2 100%);transform-origin:0 0;transform:translateX(calc((100vw - 1920px * var(--scale))/2)) scale(var(--scale))}body.snapshot{overflow:visible}body.snapshot .canvas{transform:none;position:static}.cover{display:grid;grid-template-columns:650px 1fr;gap:24px;min-height:650px}.hero-photo{position:relative;border-radius:34px;overflow:hidden;background:#fff;box-shadow:0 28px 70px rgba(132,76,45,.2)}.hero-photo img{width:100%;height:100%;object-fit:cover;display:block}.hero-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(67,31,18,.62))}.hero-fallback{width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#8b2e1f,#f2a15c);color:white;text-align:center;padding:42px}.hero-fallback strong{font-size:62px}.hero-copy{position:absolute;left:28px;right:28px;bottom:26px;z-index:1;color:#fff}.pill{display:inline-flex;align-items:center;padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.92);color:var(--red);font-size:17px;font-weight:800}h1{margin:15px 0 10px;font-size:72px;line-height:.96;letter-spacing:0}.hero-copy p{margin:0;font-size:24px;line-height:1.32;font-weight:700;text-shadow:0 3px 16px rgba(0,0,0,.24)}.cover-info{display:grid;grid-template-rows:auto auto 1fr;gap:18px}.intro,.card,.group,.step{background:rgba(255,255,255,.88);border-radius:28px;box-shadow:0 16px 42px rgba(132,76,45,.1)}.intro{padding:28px}.intro h2{margin:0 0 12px;font-size:42px}.intro p{margin:0;font-size:22px;line-height:1.42;color:#674332;font-weight:650}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.stat{background:#fff;border-radius:22px;padding:18px;min-height:112px}.stat strong{display:block;color:var(--red);font-size:34px;line-height:1;margin-bottom:10px}.stat span{color:#8c6252;font-size:15px;font-weight:800}.core{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{padding:24px}.card h3{margin:0 0 16px;font-size:25px}.check-list{display:grid;gap:12px}.check{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;font-size:18px;line-height:1.34;color:#604032;font-weight:650}.check b{width:28px;height:28px;border-radius:50%;background:#ff714d;color:#fff;display:grid;place-items:center;font-size:15px}.section-title{margin:36px 0 18px;display:flex;align-items:end;justify-content:space-between;gap:24px}.section-title h2{margin:0;font-size:40px}.section-title p{margin:0;color:#8c6252;font-size:19px;font-weight:700}.ingredient-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.group{padding:22px;min-height:260px}.group h3{margin:0 0 15px;font-size:24px;color:var(--red)}.row{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid rgba(217,77,43,.12);font-size:18px;font-weight:700}.row:last-child{border-bottom:0}.row em{font-style:normal;color:var(--red);white-space:nowrap}.phase-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.phase{background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 16px 42px rgba(132,76,45,.1)}.phase img,.image-placeholder{width:100%;height:220px;object-fit:cover;display:block}.image-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff1d6,#e9784b);color:#fff;text-align:center;padding:22px}.image-placeholder strong{font-size:20px;margin-bottom:8px}.image-placeholder span{font-size:28px;font-weight:900}.phase-body{padding:20px}.phase-kicker{display:inline-flex;padding:6px 10px;border-radius:999px;background:#fff3c9;color:var(--red);font-size:14px;font-weight:900;margin-bottom:11px}.phase h3{margin:0 0 9px;font-size:24px}.phase p{margin:0;font-size:17px;line-height:1.36;color:#614235;font-weight:650}.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.step{padding:20px;min-height:160px;display:grid;grid-template-columns:46px 1fr;gap:14px}.step-num{width:42px;height:42px;border-radius:50%;background:#ff714d;color:#fff;display:grid;place-items:center;font-size:19px;font-weight:900}.step h3{margin:0 0 8px;font-size:22px}.step p{margin:0;font-size:17px;line-height:1.38;color:#5f4034;font-weight:650}.timeline{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:18px}.time-card{background:#fff3c9;border:2px dashed rgba(214,127,44,.38);border-radius:22px;padding:18px;min-height:130px}.time-card strong{display:block;color:var(--red);font-size:22px;margin-bottom:8px}.time-card span{font-size:17px;line-height:1.36;color:#604032;font-weight:700}.footer-note{margin-top:28px;background:rgba(64,37,28,.92);color:#fff;border-radius:28px;padding:26px 30px;display:grid;grid-template-columns:repeat(${Math.min(Math.max(tips.length, 2), 4)},1fr);gap:24px}.footer-note div{border-left:4px solid #ffb164;padding-left:18px;font-size:20px;line-height:1.35;font-weight:700}.footer-note b{color:#ffcb85}
</style>
</head>
<body>
<div class="viewport">
<main class="canvas">
  <section class="cover">
    <div class="hero-photo">
      ${
        data.heroImageUrl
          ? `<img src="${attr(data.heroImageUrl)}" alt="${attr(data.dishName)}成品">`
          : `<div class="hero-fallback"><strong>${esc(data.dishName)}</strong></div>`
      }
      <div class="hero-copy">
        <div class="pill">菜谱步骤 · 状态跟做</div>
        <h1>${esc(data.dishName)}</h1>
        <p>${esc(data.subtitle)}</p>
      </div>
    </div>
    <div class="cover-info">
      <div class="intro">
        <h2>${esc(data.dishName)}怎么做稳</h2>
        <p>${esc(data.summary)}</p>
      </div>
      <div class="stats">
        <div class="stat"><strong>${esc(data.servings)}</strong><span>人份</span></div>
        <div class="stat"><strong>${esc(steps.length)} 步</strong><span>分阶段执行</span></div>
        <div class="stat"><strong>${esc(process.length)} 张</strong><span>状态图辅助</span></div>
        <div class="stat"><strong>${esc(data.difficulty)}</strong><span>难度</span></div>
      </div>
      <div class="core">
        <div class="card">
          <h3>做成的关键</h3>
          <div class="check-list">
            ${data.successKeys
              .slice(0, 3)
              .map((item, i) => `<div class="check"><b>${i + 1}</b><span>${esc(item)}</span></div>`)
              .join('')}
          </div>
        </div>
        <div class="card">
          <h3>失败预警</h3>
          <div class="check-list">
            ${data.warnings
              .slice(0, 3)
              .map((item) => `<div class="check"><b>!</b><span>${esc(item)}</span></div>`)
              .join('')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="section-title">
      <h2>食材与调料</h2>
      <p>按处理方式分组备料，开做前逐项核对。</p>
    </div>
    <div class="ingredient-grid">${renderIngredientGroups(data)}</div>
  </section>

  <section>
    <div class="section-title">
      <h2>关键状态图</h2>
      <p>看图确认状态，每个阶段都有一个判断点。</p>
    </div>
    <div class="phase-grid">
      ${process
        .map(
          (item) => `<div class="phase">
        ${imageOrPlaceholder(item.imageUrl, item.title, item.stage)}
        <div class="phase-body">
          <div class="phase-kicker">${esc(item.stage)}</div>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.checkPoint || item.description)}</p>
        </div>
      </div>`
        )
        .join('')}
    </div>
  </section>

  <section>
    <div class="section-title">
      <h2>制作步骤</h2>
      <p>只看每步耗时和状态，不用精确到每天几点。</p>
    </div>
    <div class="steps-grid">
      ${steps
        .map(
          (step) => `<div class="step"><span class="step-num">${step.index}</span><div><h3>${esc(step.title)} · ${esc(step.duration)}</h3><p>${esc(step.description)}</p></div></div>`
        )
        .join('')}
    </div>
    <div class="timeline">
      ${timeChecks
        .map(
          (item) => `<div class="time-card"><strong>${esc(item.label)} · ${esc(item.duration)}</strong><span>${esc(item.check)}</span></div>`
        )
        .join('')}
    </div>
  </section>

  <section class="footer-note">
    ${tips
      .map((tip) => {
        const [head, ...rest] = tip.split(/[：:]/);
        const body = rest.join('：');
        return `<div><b>${esc(head)}：</b>${esc(body || tip)}</div>`;
      })
      .join('')}
  </section>
</main>
</div>
</body>
</html>`;
}
