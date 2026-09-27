import { expect, it } from "vitest";
import { Session } from "../src/game/rules";
import { missionById, ammoOrder } from "../src/data/content";
import { newProgress } from "../src/game/progress";
import { juvenileBuddingLine } from "../src/data/dialogue";

const game = () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 7);
  s.availableAmmo = [...ammoOrder];
  return s;
};
const advance = (s: Session, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 120); i++) s.tick(1 / 120);
};
it("辣椒彈先變紅，延遲爆炸而不是立即範圍處置", () => {
  const s = game();
  s.ammo = "chili";
  const a = s.enemies[0];
  s.fire(a.id);
  expect(a.state).toBe("burning");
  expect(s.stats.kills).toBe(0);
  advance(s, 0.8);
  expect(a.state).toBe("disposed");
  expect(s.fragments.length).toBeGreaterThan(0);
  expect(s.drops.some((d) => d.id === a.id)).toBe(false);
});
it("碎片接觸引燃第二隻，再爆炸；同個體不重複計分", () => {
  const s = game();
  s.ammo = "chili";
  const [a, b] = s.enemies;
  for (const e of s.enemies) {
    e.state = "sleep";
    e.statusTime = 100;
    e.pos = [-23, 0, -45];
  }
  a.pos = [0, 0, -6];
  b.pos = [20, 0, -6];
  s.fire(a.id);
  advance(s, 0.7);
  const f = s.fragments[0];
  expect(f).toBeTruthy();
  b.pos = [...f.pos];
  b.pos[1] -= 0.85 * b.scale;
  advance(s, 0.02);
  expect(b.state).toBe("burning");
  advance(s, 0.8);
  expect(b.state).toBe("disposed");
  expect(s.stats.kills).toBe(2);
  advance(s, 3);
  expect(s.fragments.length).toBe(0);
  expect(s.stats.kills).toBe(2);
});
it("芽殖莖上的1至3個預約，5秒後才出生", () => {
  const counts = new Set<number>();
  for (let seed = 1; seed < 30; seed++) {
    const s = new Session(missionById("park_01"), "free", newProgress(), seed);
    s.availableAmmo = [...ammoOrder];
    s.ammo = "budding";
    const a = s.enemies[0];
    s.fire(a.id);
    const count = s.pending.length;
    counts.add(count);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
    expect(s.pending.every((p) => p.parentId === a.id)).toBe(true);
    advance(s, 4.9);
    expect(s.childSpawns).toBe(0);
    advance(s, 0.2);
    expect(s.childSpawns).toBe(count);
    expect(s.pending).toHaveLength(0);
  }
  expect([...counts].sort()).toEqual([1, 2, 3]);
});
it("重複芽殖命中不增加預約或延後出生，幼體落地後可行走", () => {
  const s = game();
  s.ammo = "budding";
  const a = s.enemies[0];
  s.fire(a.id);
  const reservations = structuredClone(s.pending);
  advance(s, 1);
  s.fire(a.id);
  expect(s.pending).toEqual(reservations);
  advance(s, 4.1);
  const children = s.enemies.filter((a) => a.birth);
  expect(children).toHaveLength(reservations.length);
  advance(s, 1);
  expect(children.every((a) => !a.birth && a.pos[1] === 0)).toBe(true);
});
it("普通彈與每種特殊彈分開計數，特殊彈耗盡不能藉換彈補充", () => {
  const s = game();
  s.ammo = "budding";
  for (let i = 0; i < 3; i++) {
    s.cooldown = 0;
    expect(s.fire(null)).toBe(true);
  }
  expect(s.specialRounds.budding).toBe(0);
  expect(s.rounds).toBe(5);
  expect(s.fire(null)).toBe(false);
  s.ammo = "chili";
  s.cooldown = 0;
  expect(s.fire(null)).toBe(true);
  expect(s.specialRounds.chili).toBe(2);
  s.ammo = "standard";
  s.cooldown = 0;
  expect(s.fire(null)).toBe(true);
  expect(s.reload()).toBe(true);
  advance(s, 3);
  expect(s.rounds).toBe(5);
  expect(s.specialRounds.budding).toBe(0);
});
it("擴充彈匣升級後，每種特殊彈各帶五發且每場重新配發", () => {
  const progress = newProgress();
  progress.upgrades.magazine_capacity_1 = 1;
  const first = new Session(missionById("park_01"), "free", progress, 7);
  first.availableAmmo = [...ammoOrder];
  expect(first.equip.specialCapacity).toBe(5);
  expect(Object.values(first.specialRounds)).toEqual([5, 5, 5, 5]);
  first.ammo = "coffee";
  first.fire(null);
  expect(first.specialRounds.coffee).toBe(4);
  const next = new Session(missionById("park_01"), "free", progress, 7);
  expect(next.specialRounds.coffee).toBe(5);
});
it("小油庫里芽殖後枝條與掛載幼體一起乾扁，屍體留在原地", () => {
  const s = game();
  s.ammo = "budding";
  const a = s.enemies[0];
  a.juvenile = true;
  a.scale = 0.5;
  const pos = [...a.pos];
  expect(s.fire(a.id)).toBe(true);
  expect(a.state).toBe("budding");
  expect(a.budCount).toBeGreaterThanOrEqual(1);
  expect(s.pending).toHaveLength(0);
  expect(s.speeches.find((speech) => speech.actorId === a.id)).toMatchObject({
    event: "budding",
    text: juvenileBuddingLine,
  });
  advance(s, 4.9);
  expect(a.pos).toEqual(pos);
  expect(s.speeches.some((speech) => speech.actorId === a.id && speech.text === juvenileBuddingLine)).toBe(true);
  advance(s, 0.3);
  expect(a.state).toBe("disposed");
  expect(s.speeches.find((speech) => speech.actorId === a.id)?.event).toBe("death");
  expect(a.deathCause).toBe("budding");
  expect(a.pos).toEqual(pos);
  expect(s.childSpawns).toBe(0);
  expect(s.enemies).toContain(a);
  advance(s, 30);
  expect(s.enemies).toContain(a);
  expect(a.budCount).toBeGreaterThanOrEqual(1);
  expect(a.pos).toEqual(pos);
});
it("辣椒命中不直接引爆遠處個體，爆炸資料會清除", () => {
  const s = game();
  s.ammo = "chili";
  const a = s.enemies[0];
  for (const e of s.enemies) {
    e.pos = [20, 0, -40];
    e.state = "sleep";
    e.statusTime = 100;
  }
  a.pos = [0, 0, -6];
  s.fire(a.id);
  advance(s, 4);
  expect(s.stats.kills).toBe(1);
  expect(s.fragments).toHaveLength(0);
  expect(s.bursts).toHaveLength(0);
});
it("戰役達到原始擊殺目標後仍等待芽殖幼體，再完成結算", () => {
  const s = new Session(missionById("park_01"), "campaign", newProgress(), 7);
  s.availableAmmo = [...ammoOrder];
  s.ammo = "budding";
  s.fire(s.enemies[0].id);
  const count = s.pending.length;
  s.ammo = "standard";
  for (const a of [...s.enemies]) {
    s.cooldown = 0;
    s.rounds = 5;
    s.fire(a.id);
  }
  advance(s, 0.1);
  expect(s.finished).toBe(false);
  advance(s, 6);
  expect(s.childSpawns).toBe(count);
  expect(s.finished).toBe(false);
  for (const a of s.enemies.filter((a) => a.state !== "disposed")) {
    s.cooldown = 0;
    s.rounds = 5;
    s.fire(a.id);
  }
  advance(s, 1.1);
  expect(s.result?.completed).toBe(true);
});
