import { it, expect } from "vitest";
import { Session } from "../src/game/rules";
import { missionById, ammoOrder } from "../src/data/content";
import { newProgress } from "../src/game/progress";
import { GameAudio, soundLayers } from "../src/ui/audio";
const game = () => {
  const s = new Session(missionById("park_01"), "free", newProgress(), 7);
  s.availableAmmo = [...ammoOrder];
  return s;
};
const advance = (s: Session, t: number) => {
  for (let i = 0; i < t * 60; i++) s.tick(1 / 60);
};
it("開槍只在成功發射時發聲，換彈三階段由規則時間觸發", () => {
  const s = game();
  s.fire(null);
  expect(s.drainSounds().map((e) => e.name)).toEqual(["standard"]);
  s.fire(null);
  expect(s.drainSounds()).toEqual([]);
  expect(s.reload()).toBe(true);
  expect(s.drainSounds().map((e) => e.name)).toEqual(["reloadOut"]);
  advance(s, s.equip.reload * 0.6);
  expect(s.drainSounds().map((e) => e.name)).toContain("reloadIn");
  advance(s, s.equip.reload * 0.5);
  expect(s.drainSounds().map((e) => e.name)).toContain("reloadReady");
  advance(s, 1);
  expect(s.drainSounds().map((e) => e.name)).not.toContain("reloadReady");
});
it("辣椒爆炸與芽殖出生音效在實際事件發生時送出", () => {
  const s = game();
  s.ammo = "chili";
  s.fire(s.enemies[0].id);
  expect(s.drainSounds().map((e) => e.name)).toEqual([
    "chili",
    "impact",
    "ignite",
  ]);
  advance(s, 0.7);
  expect(s.drainSounds().map((e) => e.name)).toContain("explode");
  const b = game();
  b.ammo = "budding";
  b.fire(b.enemies[0].id);
  expect(b.drainSounds().map((e) => e.name)).toContain("grow");
  const count = b.pending.length;
  advance(b, 4.9);
  expect(b.drainSounds().some((e) => e.name === "birth")).toBe(false);
  advance(b, 0.2);
  expect(b.drainSounds().filter((e) => e.name === "birth")).toHaveLength(count);
  advance(b, 1);
  expect(b.drainSounds().filter((e) => e.name === "land")).toHaveLength(count);
});
it("無音訊裝置可繼續遊戲，事件佇列有界且讀取後清空", () => {
  const a = new GameAudio();
  a.enable();
  a.play("standard");
  a.stop();
  expect(a.metrics().activeVoices).toBe(0);
  const s = game();
  for (let i = 0; i < 500; i++) {
    s.cooldown = 0;
    s.rounds = 5;
    s.fire(null);
  }
  expect(s.drainSounds()).toHaveLength(64);
  expect(s.drainSounds()).toHaveLength(0);
});
it("五彈種使用不同的聲音設計", () => {
  expect(
    new Set(ammoOrder.map((a) => JSON.stringify(soundLayers(a)))).size,
  ).toBe(5);
});
it("咖啡範圍誤傷同樣播放警告", () => {
  const p = newProgress();
  p.helpers.park_bait = 1;
  p.loadouts.park = ["park_bait"];
  const s = new Session(missionById("park_01"), "free", p, 7);
  s.availableAmmo = [...ammoOrder];
  s.ammo = "coffee";
  s.helpers[0].pos = [...s.enemies[0].pos];
  s.fire(s.enemies[0].id);
  expect(s.stats.helperHarm).toBe(1);
  expect(s.drainSounds().some((e) => e.name === "warning")).toBe(true);
});
