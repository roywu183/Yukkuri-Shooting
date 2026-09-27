import { describe, it, expect } from "vitest";
import {
  species,
  ammoOrder,
  catalog,
  missionById,
  type V3,
} from "../src/data/content";
import { Session, distance, equipment } from "../src/game/rules";
import { ProgressStore, newProgress } from "../src/game/progress";
describe("六種與五彈種的交叉驗證", () => {
  for (const sp of species)
    for (const ammo of ammoOrder)
      it(`${sp.name} / ${ammo}`, () => {
        const s = new Session(
          missionById("park_01"),
          "free",
          newProgress(),
          42,
        );
        s.availableAmmo = ammoOrder;
        s.ammo = ammo;
        const a = s.enemies[0];
        a.species = sp.id;
        expect(s.fire(a.id)).toBe(true);
        expect(a.state).toBe(
          (
            {
              standard: "disposed",
              chili: "burning",
              coffee: "poisoned",
              marble_soda: "sleep",
              budding: "budding",
            } as const
          )[ammo],
        );
        if (ammo === "chili") {
          for (let i = 0; i < 48; i++) s.tick(1 / 60);
          expect(a.state).toBe("disposed");
        }
        if (ammo === "budding")
          expect(s.pending.every((p) => p.species === sp.id)).toBe(true);
      });
});
describe("協力者、經濟與規則邊界", () => {
  it("招募升級與每次兩名名單，全部交易不可負值", () => {
    const data = new Map<string, string>();
    const store = new ProgressStore({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    });
    store.value.completed = ["park_01"];
    store.value.community = 200;
    const helpers = catalog.helpers.filter((h) => h.map_id === "park");
    for (const h of helpers) expect(store.recruit(h.id)).toBe(true);
    for (const h of helpers) {
      expect(store.upgradeHelper(h.id)).toBe(true);
      expect(store.upgradeHelper(h.id)).toBe(true);
      expect(store.upgradeHelper(h.id)).toBe(false);
    }
    expect(store.selectHelper("park", helpers[0].id)).toBe(true);
    expect(store.selectHelper("park", helpers[1].id)).toBe(true);
    expect(store.selectHelper("park", helpers[2].id)).toBe(false);
    expect(store.selectHelper("city", helpers[0].id)).toBe(false);
    expect(store.value.community).toBeGreaterThanOrEqual(0);
  });
  it("誘餌引導仍沿可通行線段移動而不跳點", () => {
    const p = newProgress();
    p.helpers.park_bait = 3;
    p.loadouts.park = ["park_bait"];
    const s = new Session(missionById("park_01"), "free", p, 2);
    const onRoute = (p: V3, r: V3[]) =>
      r.some((a, i) => {
        const b = r[(i + 1) % r.length];
        return (
          Math.abs(distance(a, p) + distance(p, b) - distance(a, b)) < 0.001
        );
      });
    for (let i = 0; i < 1800; i++) {
      s.tick(1 / 60);
      for (const a of s.enemies) expect(onRoute(a.pos, a.route)).toBe(true);
    }
  });
  it("誤傷協力者計分，但不能芽殖協力者", () => {
    const p = newProgress();
    p.helpers.park_bait = 1;
    p.loadouts.park = ["park_bait"];
    const s = new Session(missionById("park_01"), "free", p, 2);
    s.availableAmmo = ammoOrder;
    s.ammo = "budding";
    s.fire(s.helpers[0].id);
    expect(s.stats.helperHarm).toBe(1);
    expect(s.pending).toHaveLength(0);
    expect(s.stats.kills).toBe(0);
    expect(s.helpers[0].state).toBe("stunned");
  });
  it("汽水時間到期後恢復移動", () => {
    for (const ammo of ["marble_soda"] as const) {
      const s = new Session(missionById("park_01"), "free", newProgress(), 2);
      s.availableAmmo = ammoOrder;
      s.ammo = ammo;
      const a = s.enemies[0];
      s.fire(a.id);
      const pos = [...a.pos];
      for (let i = 0; i < 60; i++) s.tick(1 / 60);
      expect(a.pos).toEqual(pos);
      for (let i = 0; i < 540; i++) s.tick(1 / 60);
      expect(a.pos).not.toEqual(pos);
    }
  });
  it("自由模式免費換彈後，點數不足不扣款不裝填", () => {
    const s = new Session(missionById("park_01"), "free", newProgress(), 2);
    s.fire(null);
    expect(s.reload()).toBe(true);
    s.tick(3);
    s.fire(null);
    expect(s.reload()).toBe(false);
    expect(s.reloadSpent).toBe(0);
  });
  it("特殊條件與超时失敗不推進戰役", () => {
    const s = new Session(missionById("park_03"), "campaign", newProgress(), 2);
    s.stats.kills = 16;
    s.stats.shots = 20;
    s.stats.hits = 16;
    s.stats.collateral = 1;
    expect(s.finish().completed).toBe(false);
    const timeout = new Session(
      missionById("park_01"),
      "campaign",
      newProgress(),
      2,
    );
    timeout.tick(360);
    expect(timeout.finished).toBe(true);
    expect(timeout.result?.completed).toBe(false);
  });
  it("設備升級數值與許可實際套用", () => {
    const p = newProgress();
    p.upgrades = {
      rifle_speed_1: 1,
      rifle_reload_1: 1,
      magazine_reload_1: 1,
      magazine_capacity_1: 1,
      scope_zoom_1: 1,
      license_budding: 1,
    };
    expect(equipment(p)).toMatchObject({
      velocity: 1.5,
      capacity: 8,
      scope: 0.65,
    });
    expect(equipment(p).reload).toBeCloseTo(1.2);
    expect(
      new Session(missionById("park_01"), "campaign", p).availableAmmo,
    ).toContain("budding");
  });
  it("三級回收者每次回收三件，沿用既有等級容量", () => {
    const p = newProgress();
    p.helpers.factory_collector = 3;
    p.loadouts.factory = ["factory_collector"];
    const s = new Session(missionById("factory_01"), "free", p, 2);
    for (let i = 0; i < 3; i++)
      s.drops.push({
        id: 100 + i,
        pos: [...s.helpers[0].pos],
        species: "reimu",
        hat: "common_hat",
        age: 0,
      });
    s.tick(1 / 60);
    expect(s.drops).toHaveLength(0);
    expect(s.collectorPoints).toBe(60);
  });
  it("三級偵察保持舊版兩倍半徑、加1秒持續及1.5倍頻率", () => {
    const p = newProgress();
    p.helpers.factory_scout = 3;
    p.loadouts.factory = ["factory_scout"];
    const s = new Session(missionById("factory_01"), "free", p, 2);
    s.helpers[0].pos = [0, 0, 0];
    s.enemies[0].pos = [140, 0, 0];
    s.enemies[1].pos = [0, 0, 0];
    s.tick(1 / 60);
    expect(s.enemies[0].marked).toBe(0);
    expect(s.enemies[1].marked).toBe(6);
    s.enemies[1].marked = 0;
    s.tick(2);
    expect(s.enemies[1].marked).toBe(0);
  });
  it("干擾協力者不得覆蓋睡眠或芽殖狀態", () => {
    const p = newProgress();
    p.helpers.factory_disrupt = 3;
    p.loadouts.factory = ["factory_disrupt"];
    const s = new Session(missionById("factory_01"), "free", p, 2);
    const a = s.enemies[0];
    a.pos = [...s.helpers[0].pos];
    a.state = "sleep";
    a.statusTime = 8;
    s.tick(1 / 60);
    expect(a.state).toBe("sleep");
  });
});
