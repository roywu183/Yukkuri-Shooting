import { it, expect } from "vitest";
import { Session, distance } from "../src/game/rules";
import { ammoOrder, missionById } from "../src/data/content";
import { newProgress } from "../src/game/progress";
const game = () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 7);
  s.availableAmmo = [...ammoOrder];
  return s;
};
const step = (s: Session, t: number) => {
  for (let i = 0; i < t * 60; i++) s.tick(1 / 60);
};
it("同圖遠近夥伴都會驚慌、重新選逃跑路徑，速度加快", () => {
  const s = game(),
    [target, witness] = s.enemies;
  target.pos = [-15, 0, -6];
  witness.pos = [4, 0, -6];
  witness.state = "idle";
  s.fire(target.id);
  expect(
    s.enemies
      .filter((a) => a.id !== target.id)
      .every((a) => a.state === "frightened"),
  ).toBe(true);
  const before = [...witness.pos] as typeof witness.pos,
    goal = witness.route[1];
  expect(goal[0]).toBeGreaterThan(before[0]);
  s.tick(0.05);
  expect(distance(before, witness.pos)).toBeGreaterThan(
    witness.speed * 0.05 * 2,
  );
});
it.each(["standard", "coffee"] as const)(
  "%s 保留原地屍體且不可重複計分",
  (ammo) => {
    const s = game(),
      a = s.enemies[0];
    s.ammo = ammo;
    s.fire(a.id);
    if (ammo === "coffee") {
      expect(a.state).toBe("poisoned");
      step(s, 2.1);
      expect(a.deathCause).toBe("poison");
    }
    expect(a.state).toBe("disposed");
    const pos = [...a.pos],
      kills = s.stats.kills;
    step(s, 30);
    expect(s.enemies).toContain(a);
    expect(a.pos).toEqual(pos);
    s.cooldown = 0;
    s.fire(a.id);
    expect(s.stats.kills).toBe(kills);
  },
);
it("超過50具屍體仍可正常補生，存活個體不被屍體數量限制", () => {
  const s = game();
  for (let i = 0; i < 55; i++) {
    s.rounds = 5;
    s.cooldown = 0;
    s.fire(s.enemies.find((a) => a.state !== "disposed")!.id);
    s.tick(1 / 60);
  }
  expect(s.enemies.filter((a) => a.state === "disposed")).toHaveLength(55);
  expect(s.activeCount).toBe(12);
});
