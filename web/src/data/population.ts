import type { SpeciesId } from "./content";
export const spawnWeights: Record<SpeciesId, number> = {
  reimu: 0.35,
  marisa: 0.35,
  chen: 0.1,
  alice: 0.1,
  patchouli: 0.05,
  youmu: 0.05,
};
export const familyChance = 0.3;
export interface SpawnMember {
  species: SpeciesId;
  juvenile: boolean;
}
export function weightedSpecies(
  random: () => number,
  weights = spawnWeights,
): SpeciesId {
  let roll = random();
  const entries = Object.entries(weights) as [SpeciesId, number][];
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return entries.at(-1)![0];
}
export function populationEvent(
  random: () => number,
  room: number,
): { family: boolean; members: SpawnMember[] } {
  const chance = room >= 4 ? familyChance : 0;
  if (chance && random() < chance)
    return {
      family: true,
      members: [
        { species: "reimu", juvenile: false },
        { species: "marisa", juvenile: false },
        { species: "reimu", juvenile: true },
        { species: "marisa", juvenile: true },
      ],
    };
  // 家庭平均佔 4 人。校正單隻事件權重，讓含家庭的整體長期比例仍符合設定。
  const weights = { ...spawnWeights };
  for (const id of Object.keys(weights) as SpeciesId[])
    weights[id] =
      (spawnWeights[id] * (1 + 3 * chance) -
        (id === "reimu" || id === "marisa" ? 2 * chance : 0)) /
      (1 - chance);
  return {
    family: false,
    members: [{ species: weightedSpecies(random, weights), juvenile: false }],
  };
}
