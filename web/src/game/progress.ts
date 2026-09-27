import { catalog, missionById, type MapId } from "../data/content";
import type { Result } from "./rules";
export interface Progress {
  version: 1;
  workshop: number;
  community: number;
  completed: string[];
  ratings: Record<string, number>;
  upgrades: Record<string, number>;
  helpers: Record<string, number>;
  loadouts: Record<string, string[]>;
  hats: Record<string, number>;
  settled: string[];
}
export const newProgress = (): Progress => ({
  version: 1,
  workshop: 0,
  community: 0,
  completed: [],
  ratings: {},
  upgrades: {},
  helpers: {},
  loadouts: {},
  hats: {},
  settled: [],
});
export function canPlay(p: Progress, id: string) {
  const m = missionById(id);
  return (
    !!m &&
    (!m.prerequisite_mission || p.completed.includes(m.prerequisite_mission)) &&
    (m.required_missions ?? []).every((id) => p.completed.includes(id))
  );
}
export function freeUnlocked(p: Progress, map: MapId) {
  return catalog.missions.some(
    (m) =>
      m.map === map && m.sequence_in_map === 1 && p.completed.includes(m.id),
  );
}
export const completeSet = (p: Progress) =>
  catalog.headwear.every((h) => (p.hats[h.id] ?? 0) > 0);
type StorageLike = Pick<Storage, "getItem" | "setItem">;
function valid(v: unknown): v is Progress {
  if (!v || typeof v !== "object") return false;
  const p = v as Progress;
  const money = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const rec = (r: unknown) =>
    !!r &&
    typeof r === "object" &&
    !Array.isArray(r) &&
    Object.values(r).every(money);
  return (
    p.version === 1 &&
    money(p.workshop) &&
    money(p.community) &&
    Array.isArray(p.completed) &&
    p.completed.every((id) => typeof id === "string" && !!missionById(id)) &&
    Array.isArray(p.settled) &&
    p.settled.every((id) => typeof id === "string") &&
    rec(p.ratings) &&
    rec(p.upgrades) &&
    rec(p.helpers) &&
    rec(p.hats) &&
    !!p.loadouts &&
    typeof p.loadouts === "object" &&
    Object.values(p.loadouts).every(
      (ids) =>
        Array.isArray(ids) &&
        ids.length <= 2 &&
        ids.every((id) => typeof id === "string"),
    )
  );
}
export class ProgressStore {
  static key = "highground.web.v1";
  value = newProgress();
  warning = "";
  private unarchivedCorrupt?: string;
  constructor(private storage: StorageLike) {
    try {
      const raw = storage.getItem(ProgressStore.key);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (!valid(p)) throw Error("schema");
          this.value = p;
        } catch {
          try {
            storage.setItem(`${ProgressStore.key}.corrupt.${Date.now()}`, raw);
          } catch {
            this.unarchivedCorrupt = raw;
          }
          const back = storage.getItem(`${ProgressStore.key}.backup`);
          let recovered = false;
          if (back)
            try {
              const p = JSON.parse(back);
              if (valid(p)) {
                this.value = p;
                recovered = true;
              }
            } catch {}
          this.warning = recovered
            ? "存檔損毀，已恢復備份並保留原文。"
            : "存檔損毀，已保留原文並建立新進度。";
          if (this.unarchivedCorrupt)
            this.warning += " 原文仍保留於主存檔，需釋放空間後才能保存。";
        }
      }
    } catch {
      this.warning = "瀏覽器儲存不可用；可遊玩，但進度無法保存。";
    }
  }
  save() {
    try {
      if (this.unarchivedCorrupt) {
        this.storage.setItem(
          `${ProgressStore.key}.corrupt.${Date.now()}`,
          this.unarchivedCorrupt,
        );
        this.unarchivedCorrupt = undefined;
      }
      if (!valid(this.value)) throw Error("invalid");
      const previous = this.storage.getItem(ProgressStore.key);
      if (previous) {
        try {
          if (valid(JSON.parse(previous)))
            this.storage.setItem(`${ProgressStore.key}.backup`, previous);
        } catch (e) {
          if (e instanceof SyntaxError) {
          } else throw e;
        }
      }
      this.storage.setItem(ProgressStore.key, JSON.stringify(this.value));
      this.warning = "";
      return true;
    } catch {
      this.warning = "保存失敗：請確認瀏覽器儲存空間與權限，進度尚未寫入。";
      return false;
    }
  }
  transaction(fn: (p: Progress) => boolean) {
    const before = structuredClone(this.value);
    if (!fn(this.value)) {
      this.value = before;
      return false;
    }
    if (this.save()) return true;
    this.value = before;
    return false;
  }
  purchase(id: string) {
    const u = catalog.upgrades.find((u) => u.id === id);
    return this.transaction((p) => {
      if (
        !u ||
        p.workshop < u.cost ||
        (p.upgrades[id] ?? 0) >= u.max_level ||
        (u.prerequisite_mission &&
          !p.completed.includes(u.prerequisite_mission))
      )
        return false;
      p.workshop -= u.cost;
      p.upgrades[id] = (p.upgrades[id] ?? 0) + 1;
      return true;
    });
  }
  recruit(id: string) {
    const h = catalog.helpers.find((h) => h.id === id);
    return this.transaction((p) => {
      if (
        !h ||
        !freeUnlocked(p, h.map_id) ||
        p.helpers[id] ||
        p.community < h.recruit_cost
      )
        return false;
      p.community -= h.recruit_cost;
      p.helpers[id] = 1;
      return true;
    });
  }
  upgradeHelper(id: string) {
    const h = catalog.helpers.find((h) => h.id === id);
    return this.transaction((p) => {
      const level = p.helpers[id] ?? 0,
        cost = h?.upgrade_costs[level - 1];
      if (!h || level < 1 || cost === undefined || p.community < cost)
        return false;
      p.community -= cost;
      p.helpers[id]++;
      return true;
    });
  }
  selectHelper(map: MapId, id: string) {
    return this.transaction((p) => {
      if (
        !p.helpers[id] ||
        !catalog.helpers.some((h) => h.id === id && h.map_id === map)
      )
        return false;
      const list = (p.loadouts[map] ??= []);
      if (list.includes(id)) p.loadouts[map] = list.filter((x) => x !== id);
      else {
        if (list.length >= 2) return false;
        list.push(id);
      }
      return true;
    });
  }
  exchange(id: string) {
    const h = catalog.headwear.find((h) => h.id === id);
    return this.transaction((p) => {
      if (!h || !(p.hats[id] > 0)) return false;
      p.hats[id]--;
      p.community += h.community_value;
      return true;
    });
  }
  settle(r: Result) {
    if (this.value.settled.includes(r.runId)) return true;
    return this.transaction((p) => {
      p.workshop += r.workshop;
      p.community += r.community;
      for (const [h, count] of Object.entries(r.hats))
        p.hats[h] = (p.hats[h] ?? 0) + count;
      if (r.mode === "campaign") {
        p.ratings[r.missionId] = Math.max(p.ratings[r.missionId] ?? 0, r.rank);
        if (r.completed && !p.completed.includes(r.missionId))
          p.completed.push(r.missionId);
      }
      p.settled.push(r.runId);
      p.settled = p.settled.slice(-128);
      return true;
    });
  }
}
