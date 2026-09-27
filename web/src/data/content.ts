import legacy from "./legacy.json";
export type SpeciesId =
  "reimu" | "marisa" | "alice" | "patchouli" | "chen" | "youmu";
export type AmmoId =
  "standard" | "chili" | "coffee" | "marble_soda" | "budding";
export type MapId =
  | "park"
  | "city"
  | "residential"
  | "shopping_street"
  | "factory"
  | "rural"
  | "joint";
export type V3 = [number, number, number];
export const species: {
  id: SpeciesId;
  name: string;
  hair: number;
  accent: number;
  detail: string;
}[] = [
  {
    id: "reimu",
    name: "靈夢",
    hair: 0x30252d,
    accent: 0xcf434c,
    detail: "紅白蝴蝶結・兩側鬢髮",
  },
  {
    id: "marisa",
    name: "魔理沙",
    hair: 0xe7bc56,
    accent: 0x332f41,
    detail: "黑色尖帽・金色側辮",
  },
  {
    id: "alice",
    name: "愛麗絲",
    hair: 0xeaca73,
    accent: 0xc74b58,
    detail: "紅色髮箍・金色短髮",
  },
  {
    id: "patchouli",
    name: "帕秋莉",
    hair: 0x8c67b3,
    accent: 0xe0b6d4,
    detail: "月亮软帽・紫色長髮".replace("软", "軟"),
  },
  {
    id: "chen",
    name: "橙",
    hair: 0x966042,
    accent: 0x398774,
    detail: "綠色帽子・貓耳",
  },
  {
    id: "youmu",
    name: "妖夢",
    hair: 0xc6d4d6,
    accent: 0x292f39,
    detail: "黑色蝴蝶結・銀白短髮",
  },
];
export const ammoNames: Record<AmmoId, string> = {
  standard: "普通彈",
  chili: "辣椒彈",
  coffee: "咖啡彈",
  marble_soda: "彈珠汽水彈",
  budding: "芽殖彈",
};
export const ammoOrder: AmmoId[] = [
  "standard",
  "chili",
  "coffee",
  "marble_soda",
  "budding",
];
export interface Ammo {
  id: AmmoId;
  effect_id: AmmoId;
  muzzle_velocity: number;
  damage: number;
  effect_radius: number;
  status_duration_seconds: number;
  children_min: number;
  children_max: number;
}
export interface Mission {
  id: string;
  display_name: string;
  map: MapId;
  enemy: string;
  max_enemy_count: number;
  initial_enemy_count: number;
  time_limit_seconds: number;
  base_reward: number;
  wind: V3;
  available_ammo: AmmoId[];
  spawn_nodes: string[];
  sequence_in_map: number;
  prerequisite_mission?: string;
  required_missions: string[];
  minimum_accuracy: number;
  max_collateral_damage: number;
  mission_kind: string;
  story_lines: string[];
  briefing?: string;
  community_spawns?: Record<string, string>;
  enemy_overrides?: Record<string, string>;
  species: SpeciesId[];
}
export interface Upgrade {
  id: string;
  display_name: string;
  description: string;
  cost: number;
  max_level: number;
  prerequisite_mission?: string;
  sway_multiplier: number;
  muzzle_velocity_multiplier: number;
  reload_multiplier: number;
  magazine_bonus: number;
  scope_fov_multiplier: number;
  range_ticks_bonus: number;
  show_wind: boolean;
  marking_range_bonus: number;
  perception_range_bonus: number;
  identify_special_individuals: boolean;
  predict_ground_path: boolean;
  valuable_hat_threshold: number;
  ammo_license?: AmmoId;
}
export interface Helper {
  id: string;
  map_id: MapId;
  display_name: string;
  specialty: "scout" | "bait" | "disrupt" | "collector";
  recruit_cost: number;
  upgrade_costs: number[];
  effect_radius: number;
  effect_duration: number;
  support_interval: number;
}
export const mapOrder: MapId[] = [
  "park",
  "city",
  "residential",
  "shopping_street",
  "factory",
  "rural",
  "joint",
];
export const catalog = {
  maps: legacy.maps
    .map((m) => ({ id: m.id as MapId, display_name: m.display_name }))
    .sort((a, b) => mapOrder.indexOf(a.id) - mapOrder.indexOf(b.id)),
  missions: legacy.missions.map((m) => ({
    ...m,
    species: species.map((s) => s.id),
  })) as unknown as Mission[],
  ammo: legacy.ammo.map((a) =>
    a.id === "budding"
      ? { ...a, status_duration_seconds: 5, children_min: 1, children_max: 3 }
      : a,
  ) as Ammo[],
  upgrades: legacy.upgrades as unknown as Upgrade[],
  helpers: legacy.helpers as unknown as Helper[],
  headwear: legacy.headwear,
  yukkuri: legacy.yukkuri,
};
export const missionById = (id: string) =>
  catalog.missions.find((m) => m.id === id)!;
export function validateContent(): string[] {
  const errors: string[] = [];
  for (const m of catalog.missions) {
    if (!catalog.maps.some((x) => x.id === m.map)) errors.push(`${m.id}: map`);
    if (m.max_enemy_count <= 0 || m.time_limit_seconds <= 0)
      errors.push(`${m.id}: limit`);
    for (const id of [
      ...(m.required_missions ?? []),
      ...(m.prerequisite_mission ? [m.prerequisite_mission] : []),
    ])
      if (!missionById(id)) errors.push(`${m.id}: prerequisite ${id}`);
    for (const id of m.available_ammo)
      if (!catalog.ammo.some((a) => a.id === id)) errors.push(`${m.id}: ammo`);
  }
  for (const map of catalog.maps.filter((m) => m.id !== "joint"))
    if (catalog.helpers.filter((h) => h.map_id === map.id).length !== 3)
      errors.push(`${map.id}: helpers`);
  return errors;
}
