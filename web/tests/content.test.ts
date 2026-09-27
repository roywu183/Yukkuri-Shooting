import { describe, it, expect } from "vitest";
import { catalog, species, validateContent } from "../src/data/content";
describe("完整內容移植", () => {
  it("六區、十八任務與最後挑戰", () => {
    expect(catalog.maps.filter((m) => m.id !== "joint")).toHaveLength(6);
    expect(catalog.missions).toHaveLength(19);
    expect(validateContent()).toEqual([]);
  });
  it("每區三任務涵蓋六種", () => {
    for (const map of catalog.maps.filter((m) => m.id !== "joint")) {
      const missions = catalog.missions.filter((m) => m.map === map.id);
      expect(missions).toHaveLength(3);
      expect(new Set(missions.flatMap((m) => m.species))).toEqual(
        new Set(species.map((s) => s.id)),
      );
    }
  });
  it("保留既有數值與最後挑戰門檻", () => {
    expect(catalog.missions.find((m) => m.id === "park_01")).toMatchObject({
      max_enemy_count: 9,
      time_limit_seconds: 360,
      base_reward: 50,
    });
    expect(
      catalog.missions.find((m) => m.id === "joint_extermination"),
    ).toMatchObject({
      max_enemy_count: 42,
      initial_enemy_count: 36,
      base_reward: 400,
      minimum_accuracy: 0.6,
    });
    expect(catalog.ammo.find((a) => a.id === "chili")?.effect_radius).toBe(4);
  });
});
