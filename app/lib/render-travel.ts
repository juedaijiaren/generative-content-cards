import 'server-only';
import { travelSchema, type TravelData } from '@/categories/travel/schema';

type LooseRecord = Record<string, unknown>;

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as LooseRecord)
    : {};
}

function label(value: unknown, fallback = ''): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const obj = asRecord(value);
  return String(obj.name ?? obj.detail ?? obj.title ?? obj.label ?? fallback);
}

function amount(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function stopText(stop: unknown) {
  const obj = asRecord(stop);
  if (typeof stop === 'string') return stop;
  return [obj.time, obj.name, obj.note].filter(Boolean).join(' · ');
}

function drivingText(day: LooseRecord) {
  const seg = day.drivingSegment;
  if (!seg) return '';
  if (typeof seg === 'string') return seg;
  const obj = asRecord(seg);
  const route = [obj.from, obj.to].filter(Boolean).join(' → ');
  const meta = [obj.distanceKm ? `${obj.distanceKm}km` : obj.distance, obj.duration]
    .filter(Boolean)
    .join(' · ');
  return [route, meta, obj.highlight].filter(Boolean).join(' ｜ ');
}

function bbox(destination: string) {
  if (/新疆|北疆|南疆/.test(destination)) return '73,34,96,49';
  if (/川西|成都|康定|稻城/.test(destination)) return '97,27,105,34';
  if (/云南|昆明|大理|丽江/.test(destination)) return '97,21,107,30';
  if (/青甘|青海|甘肃/.test(destination)) return '92,35,104,41';
  return '97,21,107,49';
}

function budgetRows(budget: TravelData['budget']) {
  return (budget?.breakdown ?? [])
    .slice(0, 6)
    .map((item) => {
      const value =
        item.amount !== undefined && item.amount !== null
          ? amount(item.amount)
          : item.percent !== undefined && item.percent !== null
          ? `${amount(item.percent)}%`
          : '';
      return `<div class="row"><span>${esc(item.item)}</span><em>${esc(value || '-')}</em></div>`;
    })
    .join('');
}

export function renderTravelHtml(rawData: unknown): string {
  const data = travelSchema.parse(rawData);
  const days = data.days ?? [];
  const hotels = data.hotels ?? [];
  const longTrip = days.length > 6 || data.mode === 'road-trip';
  const mapUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox(data.destination)}&bboxSR=4326&imageSR=4326&size=1280,640&format=jpg&f=image`;
  const transport = asRecord(data.transport);

  return `<!DOCTYPE html>
<!-- category: travel · template: local-long-v1 -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(data.destination)} 行程一览</title>
<style>
*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:#e5e5ea;font-family:-apple-system,"PingFang SC","SF Pro Display","Noto Sans SC",sans-serif;color:#3d2c2c}body{position:relative}.canvas{--scale:min(calc(100vw / 1920px),calc(100vh / 1080px));position:absolute;top:0;left:0;width:1920px;min-height:1080px;height:auto;padding:32px;background:#faf6ee;transform-origin:0 0;transform:translateX(calc((100vw - 1920px * var(--scale))/2)) scale(var(--scale))}body.snapshot .canvas{transform:none;position:static}.overview{display:grid;grid-template-columns:2fr 1fr;gap:18px;min-height:${longTrip ? '760px' : '720px'}}.map{position:relative;border-radius:24px;overflow:hidden;background:#111;min-height:520px}.map img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(1.05)}.map::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.52))}.map-copy{position:absolute;left:30px;right:30px;bottom:26px;z-index:1;color:#fff}.chip{display:inline-flex;padding:8px 12px;border-radius:999px;background:#e07856;color:#fff;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.map h1{margin:16px 0 10px;font-size:68px;line-height:1}.map p{margin:0;width:900px;max-width:100%;font-size:25px;line-height:1.35;font-weight:650}.side{display:grid;grid-template-rows:auto auto 1fr;gap:18px}.card{background:#fff;border-radius:22px;padding:22px;box-shadow:0 14px 34px rgba(91,63,40,.08);overflow:hidden}.card h2{margin:0 0 14px;font-size:26px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.stat{background:#faf4e6;border-radius:16px;padding:16px}.stat strong{display:block;font-size:34px;color:#e07856}.stat span{font-size:14px;color:#8e7b73;font-weight:700}.row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #eadfce;font-weight:650}.row:last-child{border-bottom:0}.row em{font-style:normal;color:#a0633a;white-space:nowrap}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{padding:8px 10px;border-radius:999px;background:#faf4e6;color:#795c4f;font-size:14px;font-weight:700}.section-title{margin:32px 0 16px;display:flex;align-items:end;justify-content:space-between}.section-title h2{margin:0;font-size:36px}.section-title p{margin:0;color:#8e7b73;font-size:18px;font-weight:700}.days{display:grid;grid-template-columns:repeat(${longTrip ? 3 : Math.min(Math.max(days.length, 1), 3)},1fr);gap:16px}.day{background:#fff;border-radius:20px;padding:20px;min-height:300px;box-shadow:0 14px 34px rgba(91,63,40,.08)}.day-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}.day-index{width:42px;height:42px;border-radius:50%;background:#e07856;color:#fff;display:grid;place-items:center;font-weight:900}.day h3{margin:0;font-size:22px}.drive{background:#faf4e6;border-radius:14px;padding:12px;margin-bottom:12px;color:#795c4f;font-size:15px;line-height:1.35;font-weight:700}.stops{display:grid;gap:9px}.stop{font-size:15px;line-height:1.35;color:#5c4d4a;border-top:1px solid #eee3d4;padding-top:8px}.hotels{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.hotel{background:#fff;border-radius:18px;padding:18px;box-shadow:0 14px 34px rgba(91,63,40,.08)}.hotel h3{margin:0 0 8px;font-size:20px}.hotel p{margin:0;color:#6d5a52;font-size:15px;line-height:1.35}.tips{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:16px}.tip{background:#fff3c9;border:2px dashed rgba(224,120,86,.32);border-radius:18px;padding:16px;color:#6b4d3e;font-size:16px;line-height:1.35;font-weight:700}
</style>
</head>
<body>
<main class="canvas">
  <section class="overview">
    <div class="map">
      <img src="${mapUrl}" alt="${esc(data.destination)} 卫星路线图">
      <div class="map-copy">
        <div class="chip">${esc(data.mode)} · ${esc(data.duration ?? `${days.length} 天`)}</div>
        <h1>${esc(data.destination)}</h1>
        <p>${esc(data.tagline ?? '一张图看完整段行程：路线、预算、每日安排和住宿节点。')}</p>
      </div>
    </div>
    <aside class="side">
      <div class="card">
        <h2>行程概览</h2>
        <div class="stats">
          <div class="stat"><strong>${esc(data.durationDays ?? days.length)}</strong><span>天数</span></div>
          <div class="stat"><strong>${esc(data.mode)}</strong><span>模式</span></div>
          <div class="stat"><strong>${esc(amount(data.budget?.total) || '-')}</strong><span>${esc(data.budget?.currency ?? 'CNY')}</span></div>
          <div class="stat"><strong>${esc(hotels.length)}</strong><span>住宿节点</span></div>
        </div>
      </div>
      <div class="card">
        <h2>交通</h2>
        <div class="row"><span>去程</span><em>${esc(label(transport.outbound, '-'))}</em></div>
        <div class="row"><span>返程</span><em>${esc(label(transport.inbound, '-'))}</em></div>
        <div class="row"><span>租车</span><em>${esc(label(transport.rental, data.mode === 'road-trip' ? '建议 SUV' : '-'))}</em></div>
      </div>
      <div class="card">
        <h2>预算 / 标签</h2>
        ${budgetRows(data.budget)}
        <div class="tags">${(data.styleTags ?? []).slice(0, 8).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
      </div>
    </aside>
  </section>

  <section>
    <div class="section-title"><h2>每日行程</h2><p>${days.length} 天逐日展开，不合并为阶段。</p></div>
    <div class="days">
      ${days
        .map((day, idx) => {
          const obj = asRecord(day);
          const stops = (Array.isArray(obj.stops) ? obj.stops : []).slice(0, 6);
          return `<article class="day">
        <div class="day-head"><span class="day-index">${esc(obj.index ?? idx + 1)}</span><h3>${esc(obj.theme ?? `Day ${idx + 1}`)}</h3></div>
        ${drivingText(obj) ? `<div class="drive">${esc(drivingText(obj))}</div>` : ''}
        <div class="stops">${stops.map((stop) => `<div class="stop">${esc(stopText(stop))}</div>`).join('')}</div>
      </article>`;
        })
        .join('')}
    </div>
  </section>

  ${
    hotels.length
      ? `<section>
    <div class="section-title"><h2>住宿安排</h2><p>完整展开，覆盖所有住宿夜晚。</p></div>
    <div class="hotels">${hotels
      .map((hotel) => {
        const obj = asRecord(hotel);
        return `<article class="hotel"><h3>${esc(label(hotel, '住宿'))}</h3><p>${esc([obj.address, obj.nights ? `${obj.nights} 晚` : '', obj.pricePerNight ? `${obj.pricePerNight}/晚` : '', obj.tag].filter(Boolean).join(' · '))}</p></article>`;
      })
      .join('')}</div>
  </section>`
      : ''
  }

  <section>
    <div class="section-title"><h2>提示</h2><p>出发前重点检查。</p></div>
    <div class="tips">${(data.tips ?? []).slice(0, 8).map((tip) => `<div class="tip">${esc(tip)}</div>`).join('')}</div>
  </section>
</main>
</body>
</html>`;
}
