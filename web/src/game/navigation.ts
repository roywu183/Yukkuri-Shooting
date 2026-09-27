import type { V3 } from "../data/content";

// Conservative ground footprints of the authored scenery. Padding includes
// the character's body, so endpoints and the entire travel segment stay clear.
type Rect = [number, number, number, number];
const rect = (x: number, z: number, w: number, d: number): Rect => [
  x - w / 2,
  x + w / 2,
  z - d / 2,
  z + d / 2,
];
export function groundHeight(map: string, z: number) {
  return map === "rural"
    ? Math.max(0, Math.min(5, Math.floor((-z - 3) / 8))) * 0.35
    : 0;
}
export function groundObstacles(map: string): Rect[] {
  const result: Rect[] = [];
  if (map === "park" || map === "joint") {
    for (const [x, z] of [
      [-16, -12],
      [1, -28],
      [15, -44],
    ])
      result.push(rect(x, z, 6, 3));
    result.push(
      rect(-14, -15, 5, 4),
      rect(1, -31, 5, 4),
      rect(14, -14, 7, 6),
      rect(-14, -30, 3, 6),
      rect(-20, -11, 1.4, 1.4),
    );
  }
  if (map === "city" || map === "joint")
    for (const [x, z] of [
      [-16, -12],
      [2, -28],
      [18, -43],
    ])
      result.push(rect(x, z, 3.3, 2), rect(x + 4, z, 3.5, 2));
  if (map === "residential") {
    for (const [x, z] of [
      [-15, -12],
      [1, -28],
      [16, -44],
    ])
      result.push(rect(x, z, 4, 0.4), rect(x + 3, z, 1.8, 1.8));
    for (let i = 0; i < 5; i++) result.push(rect(-25 + i * 11, -48, 5, 4));
  }
  if (map === "shopping_street")
    for (const [x, z] of [
      [-14, -12],
      [2, -28],
      [18, -44],
    ])
      result.push(rect(x, z, 3, 1.5));
  if (map === "factory") {
    for (const [x, z] of [
      [-15, -12],
      [1, -28],
      [17, -44],
    ])
      result.push(rect(x, z, 5, 2));
    for (const x of [-25, 25]) result.push(rect(x, -47, 4, 4));
  }
  if (map === "rural")
    for (const [x, z] of [
      [-15, -12],
      [1, -28],
      [17, -44],
    ])
      result.push(rect(x, z, 3, 2), rect(x + 4, z - 3, 3, 3));
  return result;
}
const obstacles = new Map<string, Rect[]>();
export function walkable(map: string, p: V3, radius = 1) {
  if (
    p[0] < -27 + radius ||
    p[0] > 27 - radius ||
    p[2] < -48 + radius ||
    p[2] > -2 - radius
  )
    return false;
  if (!obstacles.has(map)) obstacles.set(map, groundObstacles(map));
  return !obstacles
    .get(map)!
    .some(
      ([left, right, back, front]) =>
        p[0] > left - radius &&
        p[0] < right + radius &&
        p[2] > back - radius &&
        p[2] < front + radius,
    );
}
export function clearSegment(map: string, a: V3, b: V3, radius: number) {
  if(!walkable(map,a,radius)||!walkable(map,b,radius))return false;
  // 線段與膨脹障礙矩形精確相交，避免取樣點漏掉斜擦角落。
  for(const [left,right,back,front] of obstacles.get(map)!) {
    let enter=0,exit=1;
    for(const [axis,min,max] of [[0,left-radius,right+radius],[2,back-radius,front+radius]]) {
      const delta=b[axis]-a[axis];
      if(Math.abs(delta)<1e-10){if(a[axis]<=min||a[axis]>=max){enter=2;break;}continue;}
      const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;
      enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
    }
    if(enter<=exit)return false;
  }
  return true;
}
