/**
 * 高德开放平台占位（一期 stub）
 *
 * M2 拿到 key 后在此实现：
 * - staticMapUrl({ center, zoom, size, markers, paths })  → 静态图 URL
 * - drivingRoute({ origin, destination })                 → polyline 路径
 *
 * 当前阶段：所有调用方读 useRealMap=false，走 design.prompt.md 中的 SVG fallback 分支。
 */

export const useRealMap: boolean = Boolean(process.env.AMAP_KEY);

export function staticMapUrl(): string | null {
  if (!process.env.AMAP_KEY) return null;
  // TODO: M2 实现完整 URL 构造
  return null;
}

export async function drivingRoute(): Promise<{ polyline: string } | null> {
  if (!process.env.AMAP_KEY) return null;
  // TODO: M2 调 /v3/direction/driving
  return null;
}
