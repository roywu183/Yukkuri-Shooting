import { it, expect } from "vitest";
import { catalog } from "../src/data/content";
import { Session } from "../src/game/rules";
import { ProgressStore, canPlay, freeUnlocked } from "../src/game/progress";

it("從全新存檔依先決任務完成全部19關，逐關保存且結算不可重複", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  let store = new ProgressStore(storage);
  const remaining = new Set(catalog.missions.map((m) => m.id));
  while (remaining.size) {
    const mission = catalog.missions.find(
      (m) => remaining.has(m.id) && canPlay(store.value, m.id),
    );
    expect(mission, "不可出現無法解鎖的剩餘任務").toBeDefined();
    if (!mission) break;
    const session = new Session(mission, "campaign", store.value, 123);
    for (let i = 0; !session.finished && i < 300; i++) {
      const target = session.enemies.find((a) => a.state !== "disposed");
      if (target) session.fire(target.id, true);
      if (!session.rounds) session.reload();
      session.tick(2.1);
    }
    expect(session.result?.completed, mission.id).toBe(true);
    expect(store.settle(session.result!)).toBe(true);
    const before = structuredClone(store.value);
    expect(store.settle(session.result!)).toBe(true);
    expect(store.value).toEqual(before);
    expect(store.value.workshop).toBeGreaterThanOrEqual(0);
    expect(store.value.community).toBeGreaterThanOrEqual(0);
    if (mission.sequence_in_map === 1)
      expect(freeUnlocked(store.value, mission.map)).toBe(true);
    store = new ProgressStore(storage);
    expect(store.value).toEqual(before);
    remaining.delete(mission.id);
  }
  expect(store.value.completed).toHaveLength(19);
});
