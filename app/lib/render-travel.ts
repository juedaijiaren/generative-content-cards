import 'server-only';
import { travelSchema, type TravelData } from '@/categories/travel/schema';

type LooseRecord = Record<string, unknown>;

type MapPoint = {
  day: string;
  name: string;
  lat: number;
  lng: number;
  dx: number;
  dy: number;
};

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

function dayRouteText(day: LooseRecord) {
  const stops = Array.isArray(day.stops) ? day.stops : [];
  const names = stops
    .map((stop) => label(stop))
    .filter(Boolean)
    .slice(0, 4);
  if (names.length) return names.join(' → ');

  const seg = day.drivingSegment;
  if (!seg) return '';
  if (typeof seg === 'string') return seg;
  const obj = asRecord(seg);
  return [obj.from, obj.to].filter(Boolean).join(' → ');
}

function firstUsefulStop(day: LooseRecord) {
  const stops = Array.isArray(day.stops) ? day.stops : [];
  return stops.find((stop) => {
    const obj = asRecord(stop);
    const type = String(obj.type ?? '');
    return !/rest|hotel|transport|flight|train|bus|drive/i.test(type);
  });
}

function findCoord(name: string, destination: string): [number, number] | undefined {
  const text = `${name} ${destination}`;
  const known: Array<[RegExp, [number, number]]> = [
    [/玉龙雪山|蓝月谷/, [27.1048, 100.1822]],
    [/丽江古城|大研古城|木府|四方街/, [26.8721, 100.2346]],
    [/束河/, [26.9182, 100.2088]],
    [/白沙/, [26.9629, 100.2132]],
    [/景洪|告庄|星光夜市/, [22.008, 100.7974]],
    [/中科院.*植物园|热带植物园|植物园/, [21.9218, 101.2651]],
    [/曼听|总佛寺/, [22.0018, 100.7993]],
    [/大理|洱海/, [25.6065, 100.2676]],
    [/昆明/, [25.0438, 102.706]],
    [/成都/, [30.657, 104.066]],
    [/都江堰/, [30.998, 103.618]],
    [/乐山/, [29.552, 103.765]],
    [/康定/, [30.05, 101.964]],
    [/稻城|亚丁/, [28.448, 100.329]],
    [/乌鲁木齐/, [43.8256, 87.6168]],
    [/喀纳斯/, [48.703, 87.04]],
    [/伊犁|伊宁/, [43.909, 81.277]],
    [/赛里木湖/, [44.589, 81.189]],
    [/敦煌/, [40.142, 94.662]],
    [/张掖/, [38.925, 100.449]],
    [/青海湖/, [36.88, 100.18]],
    [/东京/, [35.681, 139.767]],
    [/京都/, [35.011, 135.768]],
    [/大阪/, [34.693, 135.502]],
    [/巴黎/, [48.857, 2.352]],
    [/伦敦/, [51.507, -0.128]],
    [/厦门/, [24.479, 118.089]],
    [/三亚/, [18.252, 109.512]],
  ];
  return known.find(([pattern]) => pattern.test(text))?.[1];
}

function coordFromStop(stop: unknown, destination: string): [number, number] | undefined {
  const obj = asRecord(stop);
  const lat = Number(obj.lat ?? obj.latitude);
  const lng = Number(obj.lng ?? obj.lon ?? obj.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return findCoord(label(stop), destination);
}

function mapPoints(data: TravelData): MapPoint[] {
  const offsets = [
    [-54, 18],
    [18, -34],
    [34, 24],
    [-62, -42],
    [22, -8],
    [-50, 28],
    [28, 22],
    [-40, -22],
  ];

  const points: MapPoint[] = [];
  for (const [dayIndex, day] of data.days.entries()) {
    const dayObj = asRecord(day);
    const stops = Array.isArray(dayObj.stops) ? dayObj.stops : [];
    const candidate = firstUsefulStop(dayObj) ?? stops[0] ?? dayObj.drivingSegment;
    const coord = coordFromStop(candidate, data.destination);
    if (!coord) continue;
    const [dx, dy] = offsets[points.length % offsets.length] ?? [0, 0];
    points.push({
      day: `D${String(dayObj.index ?? dayIndex + 1)}`,
      name: label(candidate, String(dayObj.theme ?? `Day ${dayIndex + 1}`)),
      lat: coord[0],
      lng: coord[1],
      dx,
      dy,
    });
  }

  if (points.length) return points.slice(0, 12);

  const fallback = findCoord(data.destination, data.destination) ?? [25.0438, 102.706];
  return [
    {
      day: 'D1',
      name: data.destination,
      lat: fallback[0],
      lng: fallback[1],
      dx: -42,
      dy: 18,
    },
  ];
}

function destinationTheme(destination: string) {
  if (/西双版纳|版纳|热带|雨林/.test(destination)) {
    return {
      bg: '#f0efe4',
      paper: '#fffdf7',
      ink: '#202927',
      pine: '#214f3f',
      moss: '#6f8063',
      brick: '#a55338',
      gold: '#c69645',
      hero: 'https://commons.wikimedia.org/wiki/Special:FilePath/20251225%20Tropical%20rainforest%20in%20the%20Xishuangbanna%20Tropical%20Botanical%20Garden,%20Chinese%20Academy%20of%20Sciences.jpg',
    };
  }
  if (/丽江|云南|大理|昆明/.test(destination)) {
    return {
      bg: '#f4efe6',
      paper: '#fffdf8',
      ink: '#202927',
      pine: '#244c3f',
      moss: '#6f8063',
      brick: '#a55338',
      gold: '#c69645',
      hero: 'https://commons.wikimedia.org/wiki/Special:FilePath/1_lijiang_old_town_yulong_xueshan_2012.jpg',
    };
  }
  if (/川西|康定|稻城|雪山|青海|甘肃|新疆/.test(destination)) {
    return {
      bg: '#eef0ec',
      paper: '#fffdf8',
      ink: '#202833',
      pine: '#2f5267',
      moss: '#6d7766',
      brick: '#99613f',
      gold: '#c49b52',
      hero: 'https://commons.wikimedia.org/wiki/Special:FilePath/Jade_Dragon_Snow_Mountain_(48404601886).jpg',
    };
  }
  if (/海|岛|三亚|厦门/.test(destination)) {
    return {
      bg: '#edf3f0',
      paper: '#fffefa',
      ink: '#1d3034',
      pine: '#236174',
      moss: '#6f8b7e',
      brick: '#b76b43',
      gold: '#c9a44a',
      hero: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gulangyu%20Island%20Xiamen.jpg',
    };
  }
  return {
    bg: '#f2eee6',
    paper: '#fffdf8',
    ink: '#202927',
    pine: '#283f45',
    moss: '#74806c',
    brick: '#a15a3d',
    gold: '#be9447',
    hero: 'https://commons.wikimedia.org/wiki/Special:FilePath/1_lijiang_old_town_2012a.jpg',
  };
}

function imageForText(text: string, destination: string) {
  const value = `${text} ${destination}`;
  if (/玉龙雪山|雪山|蓝月谷|高海拔/.test(value)) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/Jade_Dragon_Snow_Mountain_(48404601886).jpg';
  }
  if (/丽江|古城|大研|木府|四方街|白沙|束河/.test(value)) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/1_lijiang_old_town_yulong_xueshan_2012.jpg';
  }
  if (/西双版纳|版纳|热带|植物园|雨林/.test(value)) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/20251225%20Tropical%20rainforest%20in%20the%20Xishuangbanna%20Tropical%20Botanical%20Garden,%20Chinese%20Academy%20of%20Sciences.jpg';
  }
  if (/美食|夜市|烧烤|傣味|吃|餐|饭|鱼|小吃/.test(value)) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/Dai-style_barbecue.jpg';
  }
  if (/寺|佛|曼听/.test(value)) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/Manting%20Park.jpg';
  }
  return destinationTheme(destination).hero;
}

function daySuggestion(day: LooseRecord, idx: number) {
  const text = `${day.theme ?? ''} ${dayRouteText(day)}`;
  if (/雪山|高海拔|索道/.test(text)) return '雪山日优先早出发，午后减少硬景点叠加。';
  if (/夜市|美食|烧烤|餐/.test(text)) return '夜市适合尝鲜，不建议把正餐全部压在夜市解决。';
  if (/机场|高铁|转场|出发|返程/.test(text)) return '交通日保留机动时间，不要安排远郊景点。';
  if (idx === 0) return '第一天先建立方位感，把体力留给后续核心景点。';
  return '当天只保留一个内容重心，避免为了打卡牺牲体验。';
}

function mustList(items: unknown[] | undefined, fallback: string[]) {
  const values = (items ?? []).map((item) => label(item)).filter(Boolean).slice(0, 6);
  return values.length ? values : fallback;
}

function modeLabel(mode: TravelData['mode']) {
  const labels: Record<TravelData['mode'], string> = {
    city: '城市漫游',
    'road-trip': '自驾路线',
    'multi-city': '多城转场',
  };
  return labels[mode] ?? '旅行路线';
}

export function renderTravelHtml(rawData: unknown): string {
  const data = travelSchema.parse(rawData);
  const days = data.days ?? [];
  const hotels = data.hotels ?? [];
  const points = mapPoints(data);
  const theme = destinationTheme(data.destination);
  const duration = data.duration ?? `${data.durationDays ?? days.length} 天`;
  const dayColumns = Math.min(Math.max(days.length, 1), 5);
  const eatItems = mustList(data.mustEat, ['当地特色餐', '夜市小吃', '轻量正餐']);
  const seeItems = mustList(data.mustSee, ['核心景点', '城市漫步', '目的地代表体验']);
  const heroImage = imageForText(`${data.destination} ${data.tagline ?? ''}`, data.destination);

  return `<!doctype html>
<!-- category: travel · template: local-editorial-map-v2 -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(data.destination)} 行程一览</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script async src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
:root{--bg:${theme.bg};--paper:${theme.paper};--ink:${theme.ink};--muted:#66716d;--hair:rgba(32,41,39,.12);--pine:${theme.pine};--moss:${theme.moss};--brick:${theme.brick};--gold:${theme.gold};--shadow:0 24px 70px rgba(35,40,36,.12);--radius:24px}*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:#ded8cd;color:var(--ink);font-family:"Songti SC","Noto Serif SC","PingFang SC","Hiragino Sans GB",serif}body{padding:32px;display:flex;justify-content:center}.canvas{width:1920px;min-height:1080px;background:linear-gradient(90deg,rgba(32,41,39,.035) 1px,transparent 1px),linear-gradient(rgba(32,41,39,.03) 1px,transparent 1px),var(--bg);background-size:56px 56px;border-radius:30px;overflow:hidden;box-shadow:var(--shadow);position:relative}body.snapshot{padding:0;background:var(--bg)}body.snapshot .canvas{border-radius:0;box-shadow:none}.hero{min-height:442px;display:grid;grid-template-columns:1.08fr .92fr;border-bottom:1px solid var(--hair);background:var(--paper)}.hero-copy{padding:56px 58px 46px;display:flex;flex-direction:column;justify-content:space-between}.kicker{font-family:"Avenir Next","PingFang SC",sans-serif;font-size:15px;letter-spacing:.18em;color:var(--brick);font-weight:800;text-transform:uppercase}h1{margin:18px 0 0;font-size:82px;line-height:.98;letter-spacing:0;font-weight:800}.lead{margin:26px 0 0;max-width:820px;font-size:25px;line-height:1.58;color:#4f5a56}.facts{display:flex;gap:12px;margin-top:32px;font-family:"Avenir Next","PingFang SC",sans-serif;flex-wrap:wrap}.fact{padding:13px 17px;border:1px solid var(--hair);border-radius:999px;background:#f8f4eb;font-size:14px;color:#46534f;font-weight:700}.hero-photo{min-height:442px;background:linear-gradient(180deg,rgba(20,23,20,.08),rgba(20,23,20,.42)),url("${esc(heroImage)}") center/cover;position:relative}.photo-caption{position:absolute;right:28px;bottom:24px;color:rgba(255,255,255,.82);font-family:"Avenir Next","PingFang SC",sans-serif;font-size:12px;text-shadow:0 3px 14px rgba(0,0,0,.32)}.main{padding:32px;display:grid;grid-template-columns:1.18fr .82fr;gap:24px}.card{background:rgba(255,253,248,.94);border:1px solid var(--hair);border-radius:var(--radius);box-shadow:0 16px 48px rgba(35,40,36,.08);overflow:hidden}.map-card{height:642px;display:grid;grid-template-rows:1fr auto}#routeMap{height:520px;width:100%;background:#e5e0d7}.map-note{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--hair);border-top:1px solid var(--hair);font-family:"Avenir Next","PingFang SC",sans-serif}.map-note div{background:var(--paper);padding:18px 20px}.map-note b{display:block;font-size:16px;margin-bottom:7px}.map-note span{display:block;color:var(--muted);font-size:13px;line-height:1.5}.side{display:grid;grid-template-rows:minmax(0,1.15fr) minmax(0,.85fr);gap:24px;height:642px}.route-summary{padding:26px 28px;height:100%}.section-title{margin:0 0 18px;font-size:30px;line-height:1.15;font-weight:800}.route-summary ol{margin:0;padding:0;list-style:none;display:grid;gap:10px;font-family:"Avenir Next","PingFang SC",sans-serif}.route-summary li{display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--hair)}.route-summary li:last-child{border-bottom:0}.route-summary .num{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff7ea;color:#18231f;border:2px solid var(--brick);box-shadow:inset 0 0 0 4px rgba(165,83,56,.08),0 8px 18px rgba(35,40,36,.1);font-family:"Avenir Next","PingFang SC",sans-serif;font-weight:400;font-size:22px;line-height:1;margin-top:0}.route-summary strong{display:block;font-size:16px;color:var(--ink)}.route-summary span{display:block;margin-top:5px;color:var(--muted);line-height:1.48;font-size:13px}.food-card{display:grid;grid-template-rows:134px 1fr;height:100%}.food-photo{background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.24)),url("${esc(imageForText(eatItems.join(' '), data.destination))}") center/cover}.food-copy{padding:19px 26px 22px}.food-copy h3{margin:0;font-size:26px}.food-copy p{margin:10px 0 0;font-family:"Avenir Next","PingFang SC",sans-serif;font-size:14px;line-height:1.52;color:#5d6864}.days{grid-column:1/-1;display:grid;grid-template-columns:repeat(${dayColumns},1fr);gap:16px}.day{min-height:410px;display:grid;grid-template-rows:136px auto;background:var(--paper);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;box-shadow:0 12px 34px rgba(35,40,36,.07)}.day-img{background-size:cover;background-position:center}.day-body{padding:20px;font-family:"Avenir Next","PingFang SC",sans-serif;display:flex;flex-direction:column;gap:14px}.day-head{display:flex;justify-content:space-between;gap:16px;align-items:start}.day-head h3{margin:0;font-size:22px;line-height:1.22}.tag{flex:none;padding:6px 9px;border-radius:999px;background:#edf1ec;color:var(--pine);font-size:12px;font-weight:800}.line{font-size:13px;line-height:1.54;color:#59645f;padding-bottom:12px;border-bottom:1px solid var(--hair)}.detail{display:grid;gap:9px;font-size:13px;line-height:1.5;color:#46534f}.detail b{color:var(--brick);margin-right:6px}.warn{margin-top:auto;background:#f4f0e6;border-left:4px solid var(--gold);padding:11px 12px;color:#5e5447;font-size:13px;line-height:1.45}.visuals{grid-column:1/-1;display:grid;grid-template-columns:1.2fr .8fr;gap:24px;margin-top:2px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:16px}.photo-tile{min-height:258px;border-radius:var(--radius);overflow:hidden;position:relative;background-size:cover;background-position:center;border:1px solid var(--hair);box-shadow:0 12px 34px rgba(35,40,36,.07)}.photo-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.45))}.photo-tile span{position:absolute;left:20px;right:20px;bottom:18px;z-index:1;color:white;font-family:"Avenir Next","PingFang SC",sans-serif;font-size:15px;font-weight:800;text-shadow:0 4px 16px rgba(0,0,0,.4)}.practical{padding:28px;background:#f8f5ee}.practical h2{margin:0 0 18px;font-size:32px}.chips{display:grid;gap:12px;font-family:"Avenir Next","PingFang SC",sans-serif}.chip{padding:15px 16px;border:1px solid var(--hair);border-radius:18px;background:var(--paper)}.chip b{display:block;font-size:15px;color:var(--ink)}.chip span{display:block;margin-top:6px;color:var(--muted);font-size:13px;line-height:1.5}.leaflet-control-attribution{font-size:10px}
</style>
</head>
<body>
<main class="canvas">
  <section class="hero">
    <div class="hero-copy">
      <div>
        <div class="kicker">${esc(duration)} / ${esc(modeLabel(data.mode))}</div>
        <h1>${esc(data.destination)}<br />旅行一览</h1>
        <p class="lead">${esc(data.tagline ?? '先看清路线、节奏和重点，再决定每天要把时间花在哪里。')}</p>
        <div class="facts">
          <span class="fact">${esc(duration)}</span>
          <span class="fact">${esc(days.length)} 天逐日攻略</span>
          <span class="fact">${esc(hotels.length || '多')} 个住宿节点</span>
          <span class="fact">${esc(data.budget?.currency ?? 'CNY')} ${esc(amount(data.budget?.total) || '预算待定')}</span>
        </div>
      </div>
    </div>
    <div class="hero-photo"><div class="photo-caption">${esc(data.destination)} · 先看整体节奏</div></div>
  </section>

  <section class="main">
    <section class="card map-card">
      <div id="routeMap"></div>
      <div class="map-note">
        <div><b>地图关系</b><span>先标出每日主要节点，帮助判断停留重心和转场距离。</span></div>
        <div><b>转场策略</b><span>${esc(days.length > 3 ? '把交通日和重景点拆开，减少赶路造成的体验损耗。' : '短行程优先减少折返，把时间留给核心片区。')}</span></div>
        <div><b>阅读方式</b><span>数字对应每日主节点；先看空间分布，再读逐日攻略。</span></div>
      </div>
    </section>

    <aside class="side">
      <section class="card route-summary">
        <h2 class="section-title">行程判断</h2>
        <ol>
          <li><span class="num">1</span><div><strong>先定重心</strong><span>${esc(seeItems.slice(0, 2).join('、') || data.destination)} 是这趟行程的主要内容，不必追求全景点。</span></div></li>
          <li><span class="num">2</span><div><strong>交通留白</strong><span>跨城或返程当天减少远郊安排，给天气和交通留缓冲。</span></div></li>
          <li><span class="num">3</span><div><strong>图文辅助</strong><span>景点看风光图，美食保留真实餐食图，先建立期待再读细节。</span></div></li>
          <li><span class="num">4</span><div><strong>体验优先</strong><span>每天保留一个核心内容，避免把攻略变成打卡清单。</span></div></li>
        </ol>
      </section>
      <section class="card food-card">
        <div class="food-photo"></div>
        <div class="food-copy">
          <h3>吃什么先定方向</h3>
          <p>${esc(eatItems.join('、'))}。建议把特色美食安排在城市停留日，交通日以稳妥和清淡为主，避免影响后续行程。</p>
        </div>
      </section>
    </aside>

    <section class="days">
      ${days
        .map((day, idx) => {
          const obj = asRecord(day);
          const stops = (Array.isArray(obj.stops) ? obj.stops : []).slice(0, 4);
          const title = String(obj.theme ?? `Day ${idx + 1}`);
          return `<article class="day">
        <div class="day-img" style="background-image:url('${esc(imageForText(`${title} ${dayRouteText(obj)}`, data.destination))}')"></div>
        <div class="day-body">
          <div class="day-head"><h3>Day ${esc(obj.index ?? idx + 1)} · ${esc(title)}</h3><span class="tag">${esc(idx === 0 ? '入场' : idx === days.length - 1 ? '收尾' : '重点')}</span></div>
          <div class="line">${esc(dayRouteText(obj) || '当天路线以结构化数据为准')}</div>
          <div class="detail">
            ${stops
              .slice(0, 2)
              .map((stop, stopIdx) => `<div><b>${stopIdx === 0 ? '建议' : '安排'}</b>${esc(stopText(stop))}</div>`)
              .join('')}
          </div>
          <div class="warn">${esc(daySuggestion(obj, idx))}</div>
        </div>
      </article>`;
        })
        .join('')}
    </section>

    <section class="visuals">
      <div class="gallery">
        ${[
          ...seeItems.slice(0, 2).map((item) => ({ title: item, image: imageForText(item, data.destination) })),
          ...eatItems.slice(0, 1).map((item) => ({ title: item, image: imageForText(item, data.destination) })),
          { title: `${data.destination} 城市印象`, image: heroImage },
        ]
          .slice(0, 4)
          .map((item) => `<div class="photo-tile" style="background-image:url('${esc(item.image)}')"><span>${esc(item.title)}</span></div>`)
          .join('')}
      </div>
      <aside class="card practical">
        <h2>行前优先级</h2>
        <div class="chips">
          <div class="chip"><b>先锁定核心景点</b><span>${esc(seeItems.slice(0, 3).join('、'))} 优先确认开放时间、预约和天气条件。</span></div>
          <div class="chip"><b>住宿按节奏分段</b><span>${esc(hotels.length ? '住宿节点已按行程展开，尽量减少跨城后再折返。' : '优先住在核心片区附近，减少早晚交通消耗。')}</span></div>
          <div class="chip"><b>别追求全景点</b><span>这趟行程先保证内容重心和节奏，再用零散时间补充轻量点位。</span></div>
          <div class="chip"><b>返程留余量</b><span>最后一天不要安排远郊景点，至少预留 3 小时机动。</span></div>
        </div>
      </aside>
    </section>
  </section>
</main>

<script>
const mapPoints = ${JSON.stringify(points)};
function initRouteMap() {
  if (!window.L) {
    window.setTimeout(initRouteMap, 120);
    return;
  }
  const map = L.map('routeMap', { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

  mapPoints.forEach((point) => {
    const marker = L.divIcon({
      className: '',
      html: '<div style="transform:translate(' + point.dx + 'px, ' + point.dy + 'px);background:#fffdf8;border:2px solid #202927;border-radius:18px;padding:8px 11px;box-shadow:0 8px 20px rgba(0,0,0,.16);font:800 13px Avenir Next, sans-serif;white-space:nowrap;"><span style="display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:${theme.brick};color:#fff;margin-right:5px;font-size:11px;">' + point.day + '</span>' + point.name + '</div>',
      iconAnchor: [18, 18]
    });
    L.marker([point.lat, point.lng], { icon: marker }).addTo(map);
  });

  const bounds = mapPoints.map((point) => [point.lat, point.lng]);
  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [58, 58] });
  } else {
    map.setView(bounds[0] || [25.0438, 102.706], 9);
  }
}
initRouteMap();
</script>
</body>
</html>`;
}
