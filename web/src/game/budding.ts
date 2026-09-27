import type { V3 } from "../data/content";

// 模型正面是 +Z：莖從額頭向前彎伸，幼體垂掛在莖下。
export const budOrigin: V3 = [0, 1.45, 0.86];
export function stemPoint(t: number): V3 {
  return [0, 1.1 * t - 0.7 * t * t, 2.2 * t];
}
export function hangingBud(index: number, count: number): V3 {
  const t = count === 1 ? 0.85 : 0.4 + (index * 0.5) / (count - 1);
  const p = stemPoint(t);
  return [p[0], p[1] - 0.62, p[2]];
}
