import { describe, it, expect } from "vitest";
import { Session, ballisticOffset, gradeScore } from "../src/game/rules";
import { newProgress, ProgressStore, canPlay } from "../src/game/progress";
import { missionById, ammoOrder, species } from "../src/data/content";
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
describe("射擊與完整任務", () => {
  it("風偏與下墜依飛行時間，升級初速縮小偏移", () => {
    expect(ballisticOffset(100, 500, [2, 0, 0])).toEqual([
      0.4, -0.19600000000000004, 0,
    ]);
    expect(Math.abs(ballisticOffset(100, 750, [2, 0, 0])[1])).toBeLessThan(
      0.196,
    );
  });
  it("完美命中為 S，誤傷扣安全分", () => {
    const s = {
      kills: 9,
      shots: 9,
      hits: 9,
      critical: 9,
      streak: 9,
      bestStreak: 9,
      helperHarm: 0,
      collateral: 0,
    };
    expect(gradeScore(s, 9).score).toBe(100);
    expect(gradeScore({ ...s, helperHarm: 1 }, 9).score).toBe(90);
  });
  it("不能連發、換彈時不能射擊，射空也扣彈", () => {
    const s = new Session(missionById("park_01"), "campaign", newProgress(), 1);
    s.fire(null);
    expect(s.rounds).toBe(4);
    s.fire(null);
    expect(s.rounds).toBe(4);
    s.tick(1);
    expect(s.reload()).toBe(true);
    s.fire(null);
    expect(s.rounds).toBe(4);
    s.tick(2);
    expect(s.rounds).toBe(5);
  });
  it("每一種都可被普通彈處置並掉落頭飾", () => {
    for (const sp of species) {
      const s = new Session(
        missionById("park_01"),
        "campaign",
        newProgress(),
        1,
      );
      const a = s.enemies[0];
      a.species = sp.id;
      s.fire(a.id, true);
      expect(a.state).toBe("disposed");
      expect(s.stats.kills).toBe(1);
      expect(s.drops).toHaveLength(1);
    }
  });
  it("咖啡控場、汽水睡眠、辣椒破壞頭飾", () => {
    const s = new Session(missionById("park_01"), "free", newProgress(), 1);
    s.availableAmmo = ammoOrder;
    const a = s.enemies[0];
    s.ammo = "coffee";
    s.fire(a.id);
    expect(a.state).toBe("poisoned");
    s.tick(1);
    s.ammo = "marble_soda";
    s.fire(a.id);
    expect(a.state).toBe("poisoned");
    s.tick(.81);
    s.ammo = "chili";
    s.fire(a.id);
    expect(a.state).toBe("burning");
    for (let i = 0; i < 48; i++) s.tick(1 / 60);
    expect(a.state).toBe("disposed");
    expect(s.drops.some(d=>d.id===a.id)).toBe(false);
  });
  it("芽殖預約不因母體死亡消失，普通補生維持基本族群", () => {
    const s = new Session(missionById("park_01"), "free", newProgress(), 7);
    s.availableAmmo = ammoOrder;
    s.ammo = "budding";
    s.fire(s.enemies[0].id);
    expect(s.pending.length).toBeGreaterThanOrEqual(1);
    s.tick(1);
    s.ammo = "standard";
    s.fire(s.enemies[0].id);
    for (let i = 0; i < 900; i++) s.tick(1 / 60);
    expect(s.childSpawns).toBeGreaterThanOrEqual(1);
    expect(s.pending).toHaveLength(0);
  });
  it("所有任務可在配發彈藥下完成，不需要購買芽殖彈補足目標", () => {
    for (const m of awaitCatalog()) {
      const s = new Session(m, "campaign", newProgress(), 9);
      let guard = 0;
      while (!s.finished && guard++ < 300) {
        const a = s.enemies.find((a) => a.state !== "disposed");
        if (a) s.fire(a.id, true);
        if (!s.rounds) s.reload();
        s.tick(2.1);
      }
      expect(s.result?.completed, m.id).toBe(true);
    }
  });
});
import { catalog } from "../src/data/content";
function awaitCatalog() {
  return catalog.missions;
}
describe("存檔與交易", () => {
  it("首關解鎖、後續鎖定；結算不可重複發獎", () => {
    const store = new ProgressStore(new MemoryStorage());
    expect(canPlay(store.value, "park_01")).toBe(true);
    expect(canPlay(store.value, "park_02")).toBe(false);
    const s = new Session(missionById("park_01"), "campaign", store.value, 1);
    s.stats.kills = 9;
    s.stats.hits = 9;
    s.stats.shots = 9;
    const result = s.finish();
    expect(store.settle(result)).toBe(true);
    const n = store.value.workshop;
    expect(store.settle(result)).toBe(true);
    expect(store.value.workshop).toBe(n);
    expect(canPlay(store.value, "park_02")).toBe(true);
  });
  it("餘額不足不扣點，存檔失敗回復購買", () => {
    const storage = new MemoryStorage(),
      store = new ProgressStore(storage);
    expect(store.purchase("rifle_speed_1")).toBe(false);
    store.value.workshop = 100;
    storage.setItem = () => {
      throw Error("quota");
    };
    expect(store.purchase("rifle_speed_1")).toBe(false);
    expect(store.value.workshop).toBe(100);
    expect(store.value.upgrades.rifle_speed_1).toBeUndefined();
  });
  it("重新讀取還原進度，損毀原文保留", () => {
    const st = new MemoryStorage(),
      a = new ProgressStore(st);
    a.value.community = 123;
    expect(a.save()).toBe(true);
    expect(new ProgressStore(st).value.community).toBe(123);
    st.setItem(ProgressStore.key, "broken");
    const b = new ProgressStore(st);
    expect([...st.data.values()]).toContain("broken");
    expect(b.warning).toBeTruthy();
  });
});
