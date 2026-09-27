import { expect, it } from "vitest";
import { ProgressStore, newProgress } from "../src/game/progress";
import { Session, distance } from "../src/game/rules";
import { missionById, ammoOrder, type V3 } from "../src/data/content";
function onRoute(p: V3, route: V3[]) {
  return route.some((a, i) => {
    const b = route[(i + 1) % route.length];
    return Math.abs(distance(a, p) + distance(p, b) - distance(a, b)) < 0.001;
  });
}
it("損毀原文封存失敗仍還原有效備份且不覆蓋原文", () => {
  const data = new Map([
    [ProgressStore.key, "broken"],
    [
      ProgressStore.key + ".backup",
      JSON.stringify({ ...newProgress(), workshop: 100 }),
    ],
  ]);
  const st = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k.includes(".corrupt")) throw Error("quota");
      data.set(k, v);
    },
  };
  const store = new ProgressStore(st);
  expect(store.value.workshop).toBe(100);
  expect(store.save()).toBe(false);
  expect(data.get(ProgressStore.key)).toBe("broken");
});
it("幼體隨機出生後沿當前地面線段連續行走", () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 1);
  s.availableAmmo = ammoOrder;
  s.ammo = "budding";
  s.fire(s.enemies[0].id);
  for (let i = 0; i < 1500; i++) {
    s.tick(1 / 60);
    for (const a of s.enemies.filter((a) => a.scale < 0.7)) {
      if (a.birth) {
        expect(a.pos[1]).toBeGreaterThanOrEqual(a.birth.to[1]);
        expect(a.pos[1]).toBeLessThanOrEqual(a.birth.from[1]);
        continue;
      }
      expect(onRoute(a.pos, a.route), `${a.id} ${JSON.stringify(a.pos)}`).toBe(
        true,
      );
    }
  }
  expect(s.childSpawns).toBeGreaterThan(0);
});
it("500 次回收按種類計數，結算大小不隨件數線性增加", () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 1);
  for (let i = 0; i < 500; i++) {
    s.drops.push({
      id: i,
      pos: [0, 0, 0],
      species: "reimu",
      hat: "common_hat",
      age: 0,
    });
    s.collect(i);
  }
  expect(s.collected).toEqual({ common_hat: 500 });
  expect(s.finish().hats).toEqual({ common_hat: 500 });
});
it("敵人角色使用任務出生節點覆寫而非固定機率", () => {
  const m = missionById("park_01"),
    s = new Session(m, "campaign", newProgress(), 1);
  for (let i = 0; i < s.enemies.length; i++) {
    const marker = m.spawn_nodes[i % m.spawn_nodes.length];
    expect(s.enemies[i].special).toBe(
      m.enemy_overrides?.[marker] === "park_observant" ? "慎重個體" : "",
    );
  }
});
