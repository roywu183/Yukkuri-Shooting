import { it, expect } from "vitest";
import { populationEvent, spawnWeights } from "../src/data/population";
import {
  dialoguePool,
  commonDialogue,
  speciesDialogue,
} from "../src/data/dialogue";
import { Session } from "../src/game/rules";
import { missionById, species, ammoOrder, type V3 } from "../src/data/content";
import { newProgress } from "../src/game/progress";
import { walkable } from "../src/game/navigation";
function rng() {
  let seed = 1029;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const advance = (s: Session, t: number) => {
  for (let i = 0; i < t * 60; i++) s.tick(1 / 60);
};
for (const [map, helper, state] of [
  ["park", "park_bait", "grouping"],
  ["city", "city_disrupt", "stunned"],
] as const)
  it(`${helper}支援保留家庭，效果結束後仍保持隊形`, () => {
    const p = newProgress();
    p.helpers[helper] = 3;
    p.loadouts[map] = [helper];
    const s = new Session(missionById(`${map}_01`), "free", p, 1);
    const [id, f] = [...s.families][0],
      members = f.members.map((id) => s.enemies.find((a) => a.id === id)!);
    s.helpers[0].pos = [...members[0].pos];
    const offsets = members.map((a) => [
      a.pos[0] - members[0].pos[0],
      a.pos[2] - members[0].pos[2],
    ]);
    s.tick(1 / 60);
    expect(members.every((a) => a.state === state)).toBe(true);
    s.helpers.length = 0;
    for (let i = 0; i < 900; i++) {
      s.tick(1 / 60);
      expect(s.families.has(id)).toBe(true);
      members.forEach((a, j) => {
        expect(a.pos[0] - members[0].pos[0]).toBeCloseTo(offsets[j][0], 5);
        expect(a.pos[2] - members[0].pos[2]).toBeCloseTo(offsets[j][1], 5);
      });
    }
    expect(members.every((a) => a.state === "moving")).toBe(true);
  });
function familyGame(map = "park_01") {
  for (let seed = 1; seed <= 50; seed++) {
    const s = new Session(missionById(map), "free", newProgress(), seed);
    s.availableAmmo = [...ammoOrder];
    if (s.families.size) return s;
  }
  throw Error("no family");
}
it("20萬事件含家庭的整體種類比例符合35/35/10/10/5/5，家庭事件30%", () => {
  const random = rng(),
    counts = { ...spawnWeights };
  for (const sp of species) counts[sp.id] = 0;
  let total = 0,
    families = 0;
  for (let i = 0; i < 200000; i++) {
    const event = populationEvent(random, 12);
    families += Number(event.family);
    for (const m of event.members) {
      counts[m.species]++;
      total++;
    }
  }
  expect(Math.abs(families / 200000 - 0.3)).toBeLessThan(0.005);
  for (const sp of species)
    expect(
      Math.abs(counts[sp.id] / total - spawnWeights[sp.id]),
      sp.id,
    ).toBeLessThan(0.005);
});
it("不足四個名額時不生成半家，仍用指定種類權重", () => {
  const random = rng();
  for (let i = 0; i < 100; i++)
    expect(populationEvent(random, 3).members).toHaveLength(1);
});
for (const map of [
  "park_01",
  "city_01",
  "residential_01",
  "shopping_01",
  "factory_01",
  "rural_01",
  "joint_extermination",
])
  it(`${map}：家庭四人保持隊形同行且不穿越地形`, () => {
    const s = familyGame(map),
      ids = [...s.families.values()][0].members;
    const members = ids.map((id) => s.enemies.find((a) => a.id === id)!);
    expect(members.map((a) => [a.species, a.juvenile])).toEqual([
      ["reimu", false],
      ["marisa", false],
      ["reimu", true],
      ["marisa", true],
    ]);
    const before = members.map((a) => [...a.pos] as V3),
      offsets = before.map((p) => [p[0] - before[0][0], p[2] - before[0][2]]);
    for (let i = 0; i < 1800; i++) {
      s.tick(1 / 60);
      members.forEach((a, index) => {
        expect(a.pos[0] - members[0].pos[0]).toBeCloseTo(offsets[index][0], 5);
        expect(a.pos[2] - members[0].pos[2]).toBeCloseTo(offsets[index][1], 5);
        expect(walkable(s.mission.map, a.pos, a.scale * 1.1)).toBe(true);
      });
    }
    expect(members[0].pos).not.toEqual(before[0]);
  });
it("家庭一人受傷即解散且成員逃跑，幼體使用幼體遺言，旁觀者用目擊台詞", () => {
  const s = familyGame(),
    family = [...s.families.values()][0],
    members = family.members.map((id) => s.enemies.find((a) => a.id === id)!);
  const child = members[2];
  s.fire(child.id);
  expect(members.every((a) => a.familyId === undefined)).toBe(true);
  expect(
    members.filter((a) => a !== child).every((a) => a.state === "frightened"),
  ).toBe(true);
  const death = s.speeches.find(
    (x) => x.actorId === child.id && x.event === "death",
  )!;
  expect(dialoguePool(child.species, true, "death")).toContain(death.text);
  expect(death.text).not.toContain("[該油庫里的名字]");
  expect(s.speeches.some((x) => x.event === "witness")).toBe(true);
  advance(s, 20);
  expect(members.every((a) => a.familyId === undefined)).toBe(true);
  expect(s.speeches.some((x) => x.id === death.id)).toBe(false);
});
it("91句原文全部收錄，每個種類大小與事件皆有共通及專屬台詞", () => {
  const count = (x: object): number =>
    Object.values(x).reduce(
      (n, v) => n + (Array.isArray(v) ? v.length : count(v)),
      0,
    );
  expect(count(commonDialogue) + count(speciesDialogue)).toBe(91);
  for (const sp of species)
    for (const juvenile of [false, true])
      for (const event of ["idle", "witness", "death"] as const) {
        const pool = dialoguePool(sp.id, juvenile, event);
        expect(pool.length).toBeGreaterThanOrEqual(4);
        expect(pool.every((x) => !x.includes("[該油庫里的名字]"))).toBe(true);
      }
  const s = familyGame();
  advance(s, 3);
  expect(s.speeches.some((x) => x.event === "idle")).toBe(true);
});
