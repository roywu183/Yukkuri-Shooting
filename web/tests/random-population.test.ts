import { expect, it } from "vitest";
import { Session, distance } from "../src/game/rules";
import { newProgress } from "../src/game/progress";
import { missionById } from "../src/data/content";
import { walkable, groundHeight } from "../src/game/navigation";

it("相同種子可重播，不同種子的出生位置、種類與大小不同", () => {
  const make = (seed: number) =>
    new Session(
      missionById("joint_extermination"),
      "campaign",
      newProgress(),
      seed,
    );
  const snapshot = (s: Session) =>
    s.enemies.map((a) => [a.pos, a.species, a.scale]);
  expect(snapshot(make(1))).toEqual(snapshot(make(1)));
  expect(snapshot(make(1))).not.toEqual(snapshot(make(2)));
  const s = make(1);
  expect(new Set(Array.from({length:20},(_,i)=>make(i).enemies).flat().map(a=>a.species)).size).toBe(6);
  expect(s.enemies.some((a) => a.scale < 0.85)).toBe(true);
  expect(s.enemies.some((a) => a.scale > 1.15)).toBe(true);
  for (const a of s.enemies) {
    expect(a.scale).toBeGreaterThanOrEqual(a.juvenile?0.42:0.7);
    expect(a.scale).toBeLessThanOrEqual(1.3);
    expect(a.speed).toBeGreaterThanOrEqual(0.38 * 2.2);
    for (const b of s.enemies.filter((b) => b.id > a.id))
      expect(distance(a.pos, b.pos)).toBeGreaterThan(a.scale + b.scale);
  }
});

it("未指定種子時每次出勤都重新抽樣", () => {
  const a = new Session(missionById("park_01"), "free", newProgress());
  const b = new Session(missionById("park_01"), "free", newProgress());
  expect(a.enemies.map((a) => a.pos)).not.toEqual(b.enemies.map((a) => a.pos));
});

it("持續重新選擇方向，不再重複固定閉環路線", () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 17);
  const a = s.enemies[0],
    routes = new Set<string>();
  for (let i = 0; i < 60 * 60; i++) {
    s.tick(1 / 60);
    routes.add(JSON.stringify(a.route));
  }
  expect(routes.size).toBeGreaterThan(6);
});

for (const id of [
  "park_03",
  "city_03",
  "residential_03",
  "shopping_03",
  "factory_03",
  "rural_03",
  "joint_extermination",
])
  it(`${id}：隨機移動兩分鐘不越界、不穿入設施，保持地面高度`, () => {
    const s = new Session(missionById(id), "campaign", newProgress(), 823);
    for (let i = 0; i < 2400; i++) {
      s.tick(0.05);
      for (const a of s.enemies) {
        if (!walkable(s.mission.map, a.pos, a.scale * 1.1))
          throw Error(`${id}: actor ${a.id} crossed obstacle`);
        if (a.pos[1] !== groundHeight(s.mission.map, a.pos[2]))
          throw Error(`${id}: airborne actor`);
      }
    }
    expect(s.finished).toBe(false);
  });

it("自由模式補生也抽樣，芽殖幼體更小", () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 29);
  const before = s.enemies.map((a) => JSON.stringify(a.pos));
  s.fire(s.enemies[0].id);
  s.tick(1);
  const replacement = s.enemies.at(-1)!;
  expect(before).not.toContain(JSON.stringify(replacement.pos));
  s.availableAmmo.push("budding");
  s.ammo = "budding";
  s.fire(s.enemies.find((a) => a.state !== "disposed")!.id);
  for (let i = 0; i < 1200; i++) {
    s.tick(1 / 60);
  }
  expect(s.childSpawns).toBeGreaterThan(0);
  expect(
    s.enemies
      .filter((a) => a.scale < 0.7)
      .every((a) => a.scale >= 0.42 && a.scale <= 0.62),
  ).toBe(true);
});
