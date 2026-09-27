import {
  catalog,
  ammoOrder,
  type Mission,
  type AmmoId,
  type SpeciesId,
  type V3,
} from "../data/content";
import { completeSet, type Progress } from "./progress";
import { clearSegment, groundHeight, walkable } from "./navigation";
import { budOrigin, hangingBud } from "./budding";
import type { SoundEvent, SoundName } from "./sound";
import { populationEvent, weightedSpecies } from "../data/population";
import { dialoguePool, type DialogueEvent } from "../data/dialogue";
export type State =
  | "idle"
  | "moving"
  | "grouping"
  | "hiding"
  | "frightened"
  | "stunned"
  | "poisoned"
  | "sleep"
  | "budding"
  | "burning"
  | "falling"
  | "disposed";
export interface Actor {
  id: number;
  species: SpeciesId;
  juvenile: boolean;
  familyId?: number;
  pos: V3;
  route: V3[];
  waypoint: number;
  lureWaypoint?: number;
  lureTarget?: V3;
  state: State;
  statusTime: number;
  phase: number;
  scale: number;
  helper: boolean;
  helperId?: string;
  hat: string;
  hatDestroyed: boolean;
  special: string;
  speed: number;
  fleeFrom?: V3;
  deathCause?: "standard" | "poison";
  deathAt?: number;
  age: number;
  marked: number;
  wanderLeft: number;
  budStarted?: number;
  budYaw?: number;
  exploded?: boolean;
  birth?: { from: V3; to: V3; at: number };
}
export interface Fragment {
  id: number;
  burstId: number;
  pos: V3;
  velocity: V3;
  age: number;
}
export interface Burst {
  id: number;
  pos: V3;
  scale: number;
  age: number;
  helperHits: Set<number>;
}
export interface Drop {
  id: number;
  pos: V3;
  species: SpeciesId;
  hat: string;
  age: number;
}
export interface Stats {
  kills: number;
  shots: number;
  hits: number;
  critical: number;
  streak: number;
  bestStreak: number;
  helperHarm: number;
  collateral: number;
}
export interface Result {
  runId: string;
  missionId: string;
  mode: "campaign" | "free";
  completed: boolean;
  grade: string;
  rank: number;
  score: number;
  workshop: number;
  community: number;
  hats: Record<string, number>;
  stats: Stats;
  elapsed: number;
}
export interface Equipment {
  capacity: number;
  reload: number;
  velocity: number;
  sway: number;
  scope: number;
  ticks: number;
  wind: boolean;
  marking: number;
  perception: number;
  identify: boolean;
  predict: boolean;
  hatThreshold: number;
}
export const distance = (a: V3, b: V3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function ballisticOffset(range: number, velocity: number, wind: V3): V3 {
  const t = range / Math.max(1, velocity);
  return [wind[0] * t, wind[1] * t - 9.8 * 0.5 * t * t, wind[2] * t];
}
export function gradeScore(s: Stats, count: number) {
  const n = Math.max(1, count),
    cl = (x: number) => Math.max(0, Math.min(1, x));
  const score =
    40 * cl(s.kills / n) +
    20 * cl(s.hits / Math.max(1, s.shots)) +
    15 *
      cl(
        Math.max(
          s.critical / n,
          (s.shots === s.hits ? Math.max(s.bestStreak, s.hits) : s.bestStreak) /
            n,
        ),
      ) +
    15 * cl(s.kills / Math.max(1, s.shots)) +
    Math.max(0, 10 - s.helperHarm * 10 - s.collateral * 2);
  const rank =
    score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
  return { score, rank, grade: ["", "D", "C", "B", "A", "S"][rank] };
}
export function equipment(p: Progress): Equipment {
  const e: Equipment = {
    capacity: 5,
    reload: 2,
    velocity: 1,
    sway: 1,
    scope: 1,
    ticks: 0,
    wind: false,
    marking: 0,
    perception: 0,
    identify: false,
    predict: false,
    hatThreshold: 0,
  };
  for (const u of catalog.upgrades)
    for (let i = 0; i < Math.min(p.upgrades[u.id] ?? 0, u.max_level); i++) {
      e.capacity += u.magazine_bonus;
      e.reload *= u.reload_multiplier;
      e.velocity *= u.muzzle_velocity_multiplier;
      e.sway *= u.sway_multiplier;
      e.scope *= u.scope_fov_multiplier;
      e.ticks += u.range_ticks_bonus;
      e.wind ||= u.show_wind;
      e.marking += u.marking_range_bonus;
      e.perception += u.perception_range_bonus;
      e.identify ||= u.identify_special_individuals;
      e.predict ||= u.predict_ground_path;
      if (u.valuable_hat_threshold) e.hatThreshold = u.valuable_hat_threshold;
    }
  return e;
}
export class Session {
  families = new Map<number, { members: number[]; retargetAt: number }>();
  private nextFamilyId = 1;
  speeches: {
    id: number;
    actorId: number;
    pos: V3;
    text: string;
    event: DialogueEvent;
    until: number;
  }[] = [];
  private nextSpeechId = 1;
  private nextChatter = 2;
  private lastLines = new Map<string, string>();
  private say(a: Actor, event: DialogueEvent) {
    if (a.helper) return;
    const key = `${a.species}:${a.juvenile}:${event}`,
      last = this.lastLines.get(key);
    const pool = dialoguePool(a.species, a.juvenile, event).filter(
      (line) => line !== last,
    );
    const text = pool[Math.floor(this.random() * pool.length)];
    this.lastLines.set(key, text);
    this.speeches = this.speeches.filter((s) => s.actorId !== a.id);
    this.speeches.push({
      id: this.nextSpeechId++,
      actorId: a.id,
      pos: [...a.pos],
      text,
      event,
      until: this.elapsed + (event === "death" ? 7 : 5),
    });
    this.speeches = this.speeches.slice(-12);
  }
  private witnesses(victim: Actor) {
    const nearby = this.enemies
      .filter(
        (a) =>
          a.id !== victim.id &&
          !["disposed", "burning", "poisoned", "sleep"].includes(a.state),
      )
      .sort(
        (a, b) => distance(a.pos, victim.pos) - distance(b.pos, victim.pos),
      );
    for (const a of nearby.slice(0, 3)) {
      if (
        this.speeches.some(
          (s) =>
            s.actorId === a.id &&
            s.event === "witness" &&
            s.until > this.elapsed,
        )
      )
        continue;
      this.say(a, "witness");
    }
  }
  private breakFamily(a: Actor) {
    if (a.familyId === undefined) return;
    const id = a.familyId;
    for (const member of this.enemies.filter((e) => e.familyId === id))
      member.familyId = undefined;
    this.families.delete(id);
  }
  private spawnPopulation(room: number) {
    const event = populationEvent(() => this.random(), room);
    if (!event.family) {
      this.spawn(event.members[0].species);
      return;
    }
    const scales = event.members.map((m) =>
      m.juvenile ? 0.44 + this.random() * 0.14 : 1.05 + this.random() * 0.2,
    );
    const offsets = [
      [-1.4, -1.3],
      [1.4, -1.3],
      [-1.4, 1.3],
      [1.4, 1.3],
    ];
    let positions: V3[] | undefined;
    for (let trial = 0; trial < 256; trial++) {
      const center = this.randomPosition(1.25);
      if (!center) break;
      const candidate = offsets.map(
        ([x, z]) =>
          [
            center[0] + x,
            groundHeight(this.mission.map, center[2] + z),
            center[2] + z,
          ] as V3,
      );
      if (
        candidate.every(
          (p, i) =>
            walkable(this.mission.map, p, scales[i] * 1.1) &&
            this.enemies.every(
              (a) =>
                a.state === "disposed" ||
                distance(a.pos, p) > a.scale + scales[i] + 0.2,
            ),
        )
      ) {
        positions = candidate;
        break;
      }
    }
    const members: Actor[] = [];
    for (let i = 0; i < 4; i++) {
      const a = this.actor(
        this.cursor++,
        event.members[i].species,
        undefined,
        scales[i],
        positions?.[i],
      );
      a.juvenile = event.members[i].juvenile;
      this.enemies.push(a);
      this.spawned++;
      members.push(a);
    }
    // 狹窄／擁擠區若找不到安全隊形，保留抽樣種類但分開出生。
    if (!positions) return;
    const id = this.nextFamilyId++,
      speed = Math.min(...members.map((a) => a.speed));
    for (const a of members) {
      a.familyId = id;
      a.speed = speed;
    }
    this.families.set(id, { members: members.map((a) => a.id), retargetAt: 0 });
    this.updateFamilies();
  }
  private updateFamilies() {
    for (const [id, family] of this.families) {
      const members = family.members
        .map((id) => this.enemies.find((a) => a.id === id))
        .filter((a): a is Actor => !!a);
      if (
        members.length !== 4 ||
        members.some(
          (a) => !["moving", "idle", "grouping", "stunned"].includes(a.state),
        )
      ) {
        for (const a of members) a.familyId = undefined;
        this.families.delete(id);
        continue;
      }
      if (members.some((a) => a.state === "stunned")) continue;
      if (
        this.elapsed < family.retargetAt &&
        members.some((a) => distance(a.pos, a.route[a.waypoint]) > 0.06)
      )
        continue;
      family.retargetAt = this.elapsed + 3 + this.random() * 3;
      let goals: V3[] | undefined;
      for (let trial = 0; trial < 64; trial++) {
        const lure =
          members[0].state === "grouping" ? members[0].lureTarget : undefined;
        const angle =
            lure && trial < 32
              ? Math.atan2(
                  lure[2] - members[0].pos[2],
                  lure[0] - members[0].pos[0],
                ) +
                (this.random() - 0.5) * 1.2
              : this.random() * Math.PI * 2,
          length = 3 + this.random() * 5;
        const candidate = members.map(
          (a) =>
            [
              a.pos[0] + Math.cos(angle) * length,
              groundHeight(
                this.mission.map,
                a.pos[2] + Math.sin(angle) * length,
              ),
              a.pos[2] + Math.sin(angle) * length,
            ] as V3,
        );
        if (
          candidate.every((p, i) =>
            clearSegment(
              this.mission.map,
              members[i].pos,
              p,
              members[i].scale * 1.1,
            ),
          )
        ) {
          goals = candidate;
          break;
        }
      }
      members.forEach((a, i) => {
        a.route = [[...a.pos], goals?.[i] ?? [...a.pos]];
        a.waypoint = 1;
        if (a.state !== "grouping") {
          a.state = "moving";
          a.statusTime = 0;
        }
      });
    }
  }
  private sounds: SoundEvent[] = [];
  private sound(name: SoundName, pos?: V3) {
    if (this.sounds.length < 64)
      this.sounds.push({ name, pos: pos ? [...pos] : undefined });
  }
  drainSounds() {
    return this.sounds.splice(0);
  }
  readonly runId = globalThis.crypto.randomUUID();
  readonly equip: Equipment;
  stats: Stats = {
    kills: 0,
    shots: 0,
    hits: 0,
    critical: 0,
    streak: 0,
    bestStreak: 0,
    helperHarm: 0,
    collateral: 0,
  };
  enemies: Actor[] = [];
  helpers: Actor[] = [];
  drops: Drop[] = [];
  pending: {
    species: SpeciesId;
    route: V3[];
    origin?: V3;
    due: number;
    parentId?: number;
    attachment?: V3;
    yaw?: number;
    parentScale?: number;
  }[] = [];
  fragments: Fragment[] = [];
  bursts: Burst[] = [];
  private effectId = 1;
  availableAmmo: AmmoId[];
  ammo: AmmoId = "standard";
  rounds: number;
  reloadLeft = 0;
  cooldown = 0;
  elapsed = 0;
  finished = false;
  result?: Result;
  spawned = 0;
  childSpawns = 0;
  population = 12;
  pendingPoints = 0;
  collected: Record<string, number> = {};
  collectorPoints = 0;
  reloadSpent = 0;
  freeReload = true;
  feedback = "觀察地面路徑，留意綠色徽章。";
  lastImpact?: { pos: V3; kind: AmmoId; at: number };
  private nextId = 1;
  private cursor = 0;
  private supportTimers = new Map<string, number>();
  constructor(
    public mission: Mission,
    public mode: "campaign" | "free",
    public progress: Progress,
    private seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0],
  ) {
    this.equip = equipment(progress);
    this.rounds = this.equip.capacity;
    this.availableAmmo = ammoOrder.filter(
      (id) =>
        mission.available_ammo.includes(id) ||
        catalog.upgrades.some(
          (u) => u.ammo_license === id && (progress.upgrades[u.id] ?? 0) > 0,
        ),
    );
    const initial =
      mode === "free"
        ? this.population
        : mission.initial_enemy_count || mission.max_enemy_count;
    while (this.activeCount < initial)
      this.spawnPopulation(initial - this.activeCount);
    if (mode === "free")
      for (const id of progress.loadouts[mission.map] ?? []) {
        const h = catalog.helpers.find(
          (h) => h.id === id && h.map_id === mission.map,
        );
        if (h && progress.helpers[id] && this.helpers.length < 2)
          this.addHelper(id, this.helpers.length);
      }
    else
      for (const id of Object.keys(mission.community_spawns ?? {}))
        this.addHelper(undefined, this.helpers.length, id);
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  get activeCount() {
    return this.enemies.filter((a) => a.state !== "disposed").length;
  }
  private get collapseFinished() {
    return !this.enemies.some(
      (a) =>
        a.state === "disposed" &&
        !a.exploded &&
        this.elapsed - (a.deathAt ?? 0) < 1,
    );
  }
  private randomPosition(
    scale: number,
    near?: V3,
    allowCrowded = false,
  ): V3 | undefined {
    let fallback: V3 | undefined;
    for (let i = 0; i < 512; i++) {
      const local = near && i < 96;
      const x = local
        ? near[0] + (this.random() - 0.5) * 12
        : -25 + this.random() * 50;
      const z = local
        ? near[2] + (this.random() - 0.5) * 12
        : -46 + this.random() * 42;
      const p: V3 = [x, groundHeight(this.mission.map, z), z];
      if (walkable(this.mission.map, p, scale * 1.1)) fallback = p;
      if (
        walkable(this.mission.map, p, scale * 1.1) &&
        [...this.enemies, ...this.helpers].every(
          (a) =>
            a.state === "disposed" ||
            distance(a.pos, p) > a.scale + scale + 0.2,
        )
      )
        return p;
    }
    return allowCrowded ? fallback : undefined;
  }
  private wander(a: Actor, toward?: V3) {
    if (a.state === "frightened" && a.fleeFrom)
      toward = [
        a.pos[0] * 2 - a.fleeFrom[0],
        a.pos[1],
        a.pos[2] * 2 - a.fleeFrom[2],
      ];
    for (let i = 0; i < 48; i++) {
      const angle =
        toward && i < 32
          ? Math.atan2(toward[2] - a.pos[2], toward[0] - a.pos[0]) +
            (this.random() - 0.5) * 1.2
          : this.random() * Math.PI * 2;
      const length = 2 + this.random() * 8;
      const z = a.pos[2] + Math.sin(angle) * length;
      const target: V3 = [
        a.pos[0] + Math.cos(angle) * length,
        groundHeight(this.mission.map, z),
        z,
      ];
      if (!clearSegment(this.mission.map, a.pos, target, a.scale * 1.1))
        continue;
      a.route = [[...a.pos], target];
      a.waypoint = 1;
      a.wanderLeft = 2 + this.random() * 4;
      return;
    }
    a.route = [[...a.pos], [...a.pos]];
    a.waypoint = 1;
    a.wanderLeft = 0.4;
  }
  private actor(
    index: number,
    sp?: SpeciesId,
    route?: V3[],
    scale = 0.7 + this.random() * 0.6,
    birthPosition?: V3,
  ): Actor {
    const p = birthPosition ?? this.randomPosition(scale, route?.[0]);
    if (!p) throw new Error("沒有可用的安全出生位置");
    const r = [p, p];
    const marker =
      this.mission.spawn_nodes[index % this.mission.spawn_nodes.length];
    const role = catalog.yukkuri.find(
      (d) =>
        d.id === (this.mission.enemy_overrides?.[marker] ?? this.mission.enemy),
    )!;
    const actor: Actor = {
      id: this.nextId++,
      species: sp ?? weightedSpecies(() => this.random()),
      juvenile: scale < 0.7,
      pos: [...r[0]],
      route: r.map((p) => [...p]),
      waypoint: 1,
      state: "moving",
      statusTime: 0,
      phase: this.random() * 6.28,
      scale,
      helper: false,
      hat: role.headwear,
      hatDestroyed: false,
      special: role.special_identity,
      speed: role.ground_speed * (2.2 + this.random() * 1.2),
      age: 0,
      marked: 0,
      wanderLeft: 0,
    };
    this.wander(actor);
    return actor;
  }
  private spawn(sp?: SpeciesId, route?: V3[], child = false) {
    const a = this.actor(
      this.cursor++,
      sp,
      route,
      child ? 0.42 + this.random() * 0.2 : undefined,
      child ? route?.[0] : undefined,
    );
    if (child) {
      this.childSpawns++;
    }
    this.enemies.push(a);
    this.spawned++;
    return a;
  }
  private addHelper(id: string | undefined, index: number, _marker?: string) {
    const a = this.actor(index);
    a.helper = true;
    a.helperId = id;
    a.species = this.mission.species[(index + 2) % 6];
    a.pos = [index ? 15 : -14, 0, -1];
    a.route = [[...a.pos], [a.pos[0] + 3, 0, -3], [a.pos[0] + 1, 0, -6]];
    a.hat = "common_hat";
    a.special = "社區協力者";
    a.speed = 0.32;
    this.helpers.push(a);
  }
  tick(dt: number) {
    if (this.finished || dt <= 0 || !Number.isFinite(dt)) return;
    this.elapsed += dt;
    this.speeches = this.speeches.filter((s) => s.until > this.elapsed);
    if (this.elapsed >= this.nextChatter) {
      this.nextChatter = this.elapsed + 3 + this.random() * 4;
      const eligible = this.enemies.filter((a) =>
        ["moving", "idle", "grouping"].includes(a.state),
      );
      if (eligible.length)
        this.say(eligible[Math.floor(this.random() * eligible.length)], "idle");
    }
    this.updateFamilies();
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadLeft > 0) {
      const before = this.reloadLeft;
      this.reloadLeft = Math.max(0, this.reloadLeft - dt);
      if (
        before > this.equip.reload * 0.45 &&
        this.reloadLeft <= this.equip.reload * 0.45
      )
        this.sound("reloadIn");
      if (!this.reloadLeft) {
        this.rounds = this.equip.capacity;
        this.sound("reloadReady");
      }
    }
    for (const a of [...this.enemies, ...this.helpers]) {
      a.age += dt;
      a.marked = Math.max(0, a.marked - dt);
      if (a.state === "disposed") continue;
      if (a.state === "burning") {
        a.statusTime -= dt;
        if (a.statusTime <= 0) this.explode(a);
        continue;
      }
      if (a.state === "poisoned") {
        a.statusTime -= dt;
        if (a.statusTime <= 0) this.dispose(a, "poison");
        continue;
      }
      if (a.birth) {
        const t = Math.min(1, (this.elapsed - a.birth.at) / 0.65);
        for (let j = 0; j < 3; j++)
          a.pos[j] =
            a.birth.from[j] +
            (a.birth.to[j] - a.birth.from[j]) * (j === 1 ? t * t : t);
        if (t >= 1) {
          this.sound("land", a.pos);
          a.birth = undefined;
          if (a.state === "falling") a.state = "moving";
          this.wander(a);
        }
        continue;
      }
      if (a.statusTime > 0) {
        a.statusTime -= dt;
        if (a.statusTime <= 0) {
          if (["sleep", "stunned"].includes(a.state)) this.sound("wake", a.pos);
          a.state = "moving";
          a.fleeFrom = undefined;
          a.lureWaypoint = undefined;
          a.lureTarget = undefined;
        }
        if (["sleep", "stunned", "budding", "hiding", "idle"].includes(a.state))
          continue;
      }
      if (!a.helper) {
        a.wanderLeft -= dt;
        const goal = a.route[a.waypoint];
        if (
          a.familyId === undefined &&
          (a.wanderLeft <= 0 || distance(a.pos, goal) < 0.06)
        ) {
          this.wander(a, a.state === "grouping" ? a.lureTarget : undefined);
          if (a.state === "moving" && this.random() < 0.16) {
            a.state = "idle";
            a.statusTime = 0.25 + this.random() * 0.65;
            continue;
          }
        }
        const next = a.route[a.waypoint];
        const d = Math.hypot(next[0] - a.pos[0], next[2] - a.pos[2]);
        const step = Math.min(
          d,
          dt * a.speed * (a.state === "frightened" ? 2.5 : 1),
        );
        if (d > 0) {
          a.pos[0] += ((next[0] - a.pos[0]) / d) * step;
          a.pos[2] += ((next[2] - a.pos[2]) / d) * step;
          a.pos[1] = groundHeight(this.mission.map, a.pos[2]);
        }
        continue;
      }
      const next = a.route[a.waypoint % a.route.length],
        d = distance(a.pos, next);
      if (d < 0.008) {
        a.pos = [...next];
        const lured = a.lureWaypoint === a.waypoint % a.route.length;
        a.waypoint++;
        if (lured) {
          a.state = "idle";
          a.lureWaypoint = undefined;
        } else if (a.state !== "grouping" && this.random() < 0.25) {
          a.state = this.random() < 0.5 ? "idle" : "hiding";
          a.statusTime = 1 + this.random() * 2;
        }
      } else {
        const step = Math.min(
          d,
          dt * a.speed * (a.state === "frightened" ? 1.8 : 1),
        );
        for (let j = 0; j < 3; j++)
          a.pos[j] += ((next[j] - a.pos[j]) / d) * step;
      }
    }
    this.updateFragments(dt);
    this.enemies = this.enemies.filter(
      (a) => !a.exploded || a.statusTime > this.elapsed,
    );
    this.drops.forEach((d) => (d.age += dt));
    this.drops = this.drops.filter((d) => d.age < 120).slice(-24);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (p.due > this.elapsed) continue;
      const pos = this.randomPosition(0.62, p.origin ?? p.route[0], true);
      if (pos) {
        const a = this.spawn(p.species, [pos], true);
        const parent = this.enemies.find((a) => a.id === p.parentId);
        const origin = parent?.pos ?? p.origin ?? pos;
        const scale = parent?.scale ?? p.parentScale ?? 1;
        const attachment = p.attachment ?? hangingBud(0, 1);
        const yaw = p.yaw ?? 0,
          x = (budOrigin[0] + attachment[0]) * scale,
          z = (budOrigin[2] + attachment[2]) * scale;
        const from: V3 = [
          origin[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
          origin[1] + (budOrigin[1] + attachment[1]) * scale,
          origin[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
        ];
        a.pos = from;
        a.birth = { from: [...from], to: pos, at: this.elapsed };
        a.state = "falling";
        this.sound("birth", from);
        this.pending.splice(i, 1);
      }
    }
    if (this.mode === "free") {
      if (
        this.activeCount + this.pending.length < this.population &&
        this.activeCount < 50
      ) {
        this.spawnPopulation(
          this.population - this.activeCount - this.pending.length,
        );
      }
      this.support(dt);
    } else {
      if (
        this.activeCount === 0 &&
        this.pending.length === 0 &&
        this.spawned < this.mission.max_enemy_count
      )
        this.spawnPopulation(this.mission.max_enemy_count - this.spawned);
      if (
        (this.stats.kills >= this.mission.max_enemy_count &&
          this.activeCount === 0 &&
          this.pending.length === 0 &&
          this.collapseFinished) ||
        this.elapsed >= this.mission.time_limit_seconds
      )
        this.finish();
    }
  }
  private ignite(a: Actor) {
    if (a.helper || a.state === "disposed" || a.state === "burning") return;
    this.sound("ignite", a.pos);
    this.breakFamily(a);
    this.frightenWitnesses(a.pos);
    a.state = "burning";
    a.statusTime = 0.65;
    a.hatDestroyed = true;
    a.birth = undefined;
  }
  private explode(a: Actor) {
    if (a.exploded || a.state === "disposed") return;
    a.exploded = true;
    this.sound("explode", a.pos);
    this.frightenWitnesses(a.pos);
    const pos: V3 = [a.pos[0], a.pos[1] + 0.85 * a.scale, a.pos[2]];
    const id = this.effectId++;
    this.bursts.push({
      id,
      pos,
      scale: a.scale,
      age: 0,
      helperHits: new Set(),
    });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + (this.random() - 0.5) * 0.16;
      const speed = 5 + this.random() * 4;
      this.fragments.push({
        id: this.effectId++,
        burstId: id,
        pos: [...pos],
        velocity: [
          Math.cos(angle) * speed,
          1.2 + this.random() * 3,
          Math.sin(angle) * speed,
        ],
        age: 0,
      });
    }
    this.fragments = this.fragments.slice(-768);
    this.dispose(a);
  }
  private updateFragments(dt: number) {
    for (const b of this.bursts) b.age += dt;
    this.bursts = this.bursts.filter((b) => b.age < 2.2).slice(-64);
    for (const f of this.fragments) {
      const old: V3 = [...f.pos];
      f.age += dt;
      f.velocity[1] -= 9.8 * dt;
      for (let j = 0; j < 3; j++) f.pos[j] += f.velocity[j] * dt;
      const floor = groundHeight(this.mission.map, f.pos[2]) + 0.12;
      if (f.pos[1] < floor) {
        f.pos[1] = floor;
        f.velocity[1] = Math.abs(f.velocity[1]) * 0.3;
        f.velocity[0] *= 0.7;
        f.velocity[2] *= 0.7;
      }
      const v = f.pos.map((n, j) => n - old[j]);
      const length = v.reduce((n, x) => n + x * x, 0);
      for (const a of [...this.enemies, ...this.helpers]) {
        if (a.state === "disposed" || a.state === "burning") continue;
        const center: V3 = [a.pos[0], a.pos[1] + 0.85 * a.scale, a.pos[2]];
        const t = Math.max(
          0,
          Math.min(
            1,
            center.reduce((n, x, j) => n + (x - old[j]) * v[j], 0) /
              Math.max(length, 0.000001),
          ),
        );
        const closest: V3 = [
          old[0] + v[0] * t,
          old[1] + v[1] * t,
          old[2] + v[2] * t,
        ];
        if (distance(closest, center) > 0.85 * a.scale + 0.16) continue;
        if (a.helper) {
          const burst = this.bursts.find((b) => b.id === f.burstId);
          if (burst && !burst.helperHits.has(a.id)) {
            burst.helperHits.add(a.id);
            this.stats.helperHarm++;
            this.sound("warning", a.pos);
            a.state = "stunned";
            a.statusTime = 3;
          }
        } else this.ignite(a);
      }
    }
    this.fragments = this.fragments.filter((f) => f.age < 1.8);
  }
  fire(
    targetId: number | null,
    critical = false,
    collateral = false,
    impact?: V3,
  ) {
    if (
      this.finished ||
      this.reloadLeft > 0 ||
      this.cooldown > 0 ||
      this.rounds <= 0 ||
      !this.availableAmmo.includes(this.ammo)
    )
      return false;
    this.rounds--;
    this.sound(this.ammo);
    this.cooldown = 0.8;
    this.stats.shots++;
    const target = [...this.enemies, ...this.helpers].find(
      (a) => a.id === targetId && a.state !== "disposed",
    );
    if (target && !target.helper) {
      this.stats.hits++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(
        this.stats.bestStreak,
        this.stats.streak,
      );
      if (critical) this.stats.critical++;
    } else this.stats.streak = 0;
    if (collateral) {
      this.sound("ricochet", impact);
      this.stats.collateral++;
      this.feedback = "擊中設施，附帶損害增加。";
    } else
      this.feedback = target
        ? `${target.helper ? "誤傷協力者！" : critical ? "關鍵命中" : "命中"} · ${this.ammo}`
        : "射空，請修正風偏與落點。";
    const ammo = catalog.ammo.find((a) => a.id === this.ammo)!;
    const center = impact ?? target?.pos;
    if (center)
      this.lastImpact = { pos: [...center], kind: this.ammo, at: this.elapsed };
    if (target) {
      this.breakFamily(target);
      this.sound(target.helper ? "warning" : "impact", target.pos);
      const affected =
        this.ammo === "coffee"
          ? [...this.enemies, ...this.helpers].filter(
              (a) =>
                a.state !== "disposed" &&
                distance(a.pos, target.pos) <= ammo.effect_radius,
            )
          : [target];
      for (const a of affected) {
        if (a.helper) {
          this.stats.helperHarm++;
          this.sound("warning", a.pos);
          a.state = "stunned";
          a.statusTime = ammo.status_duration_seconds || 3;
          continue;
        }
        if (
          a.state === "burning" ||
          (a.state === "poisoned" &&
            this.ammo !== "standard" &&
            this.ammo !== "chili")
        )
          continue;
        if (
          this.ammo === "budding" &&
          this.pending.some((p) => p.parentId === a.id)
        )
          continue;
        if (this.ammo === "chili") {
          this.ignite(a);
          continue;
        }
        if (this.ammo === "standard") {
          this.dispose(a);
        } else {
          a.state =
            this.ammo === "coffee"
              ? "poisoned"
              : this.ammo === "marble_soda"
                ? "sleep"
                : "budding";
          if (this.ammo === "coffee") this.sound("stun", a.pos);
          if (this.ammo === "marble_soda") this.sound("sleep", a.pos);
          a.statusTime =
            this.ammo === "coffee" ? 2 : ammo.status_duration_seconds;
        }
      }
      if (
        this.ammo === "budding" &&
        !target.helper &&
        target.state !== "burning" &&
        target.state !== "poisoned" &&
        !this.pending.some((p) => p.parentId === target.id)
      ) {
        target.budStarted = this.elapsed;
        this.sound("grow", target.pos);
        const next = target.route[target.waypoint % target.route.length];
        target.budYaw = Math.atan2(
          next[0] - target.pos[0],
          next[2] - target.pos[2],
        );
        const count =
          ammo.children_min +
          Math.floor(
            this.random() * (ammo.children_max - ammo.children_min + 1),
          );
        for (let i = 0; i < count; i++)
          this.pending.push({
            species: target.species,
            route: target.route.map((p) => [...p]),
            origin: [...target.pos],
            parentId: target.id,
            attachment: hangingBud(i, count),
            yaw: target.budYaw,
            parentScale: target.scale,
            due: this.elapsed + ammo.status_duration_seconds,
          });
        this.feedback = `芽殖中：已預約 ${count} 隻幼體。`;
      }
    }
    if (target && !target.helper) this.frightenWitnesses(target.pos);
    if (
      this.mode === "campaign" &&
      this.stats.kills >= this.mission.max_enemy_count &&
      this.activeCount === 0 &&
      this.pending.length === 0 &&
      this.collapseFinished
    )
      this.finish();
    return true;
  }
  private frightenWitnesses(origin: V3) {
    for (const a of this.enemies) {
      if (
        !["moving", "idle", "hiding", "grouping", "frightened"].includes(
          a.state,
        )
      )
        continue;
      a.state = "frightened";
      this.breakFamily(a);
      a.statusTime = 6 + this.random() * 2;
      a.fleeFrom = [...origin];
      a.lureTarget = undefined;
      this.wander(a);
    }
  }
  private dispose(a: Actor, cause: "standard" | "poison" = "standard") {
    if (a.state === "disposed") return;
    this.breakFamily(a);
    this.say(a, "death");
    this.witnesses(a);
    a.deathCause = cause;
    a.deathAt = this.elapsed;
    a.birth = undefined;
    a.pos[1] = groundHeight(this.mission.map, a.pos[2]);
    a.state = "disposed";
    a.statusTime = this.elapsed + 0.55;
    this.stats.kills++;
    if (this.mode === "free")
      this.pendingPoints += Math.round(
        5 * (completeSet(this.progress) ? 1.5 : 1),
      );
    if (!a.hatDestroyed) {
      this.sound("land", a.pos);
      this.drops.push({
        id: a.id,
        pos: [...a.pos],
        species: a.species,
        hat: a.hat,
        age: 0,
      });
      this.drops = this.drops.slice(-24);
    }
  }
  reload() {
    if (
      this.finished ||
      this.reloadLeft > 0 ||
      this.rounds === this.equip.capacity
    )
      return false;
    const cost = this.equip.capacity - this.rounds;
    if (this.mode === "free") {
      if (this.freeReload) this.freeReload = false;
      else {
        if (
          this.progress.community +
            this.pendingPoints +
            this.collectorPoints -
            this.reloadSpent <
          cost
        ) {
          this.feedback = "社區點數不足，請先回收頭飾或離開結算。";
          return false;
        }
        this.reloadSpent += cost;
      }
    }
    this.reloadLeft = this.equip.reload;
    this.sound("reloadOut");
    return true;
  }
  collect(id?: number) {
    const d =
      id === undefined ? this.drops[0] : this.drops.find((d) => d.id === id);
    if (!d) return false;
    this.collected[d.hat] = (this.collected[d.hat] ?? 0) + 1;
    this.drops = this.drops.filter((x) => x !== d);
    this.feedback = "已保留完整頭飾，離開時加入收藏。";
    this.sound("collect");
    return true;
  }
  private support(dt: number) {
    for (const a of this.helpers) {
      if (a.state === "stunned") continue;
      const h = catalog.helpers.find((h) => h.id === a.helperId);
      if (!h) continue;
      const remain = (this.supportTimers.get(h.id) ?? 0) - dt;
      if (remain > 0) {
        this.supportTimers.set(h.id, remain);
        continue;
      }
      const level = this.progress.helpers[h.id] ?? 1;
      const radius = h.effect_radius * (1 + 0.5 * (level - 1));
      const duration = h.effect_duration + 0.5 * (level - 1);
      this.supportTimers.set(
        h.id,
        h.support_interval / (1 + 0.25 * (level - 1)),
      );
      let nearby = this.enemies.filter(
        (e) => e.state !== "disposed" && distance(e.pos, a.pos) <= radius,
      );
      if (h.specialty === "bait" || h.specialty === "disrupt") {
        const familyIds = new Set(
          nearby.map((e) => e.familyId).filter((id) => id !== undefined),
        );
        nearby = this.enemies.filter(
          (e) =>
            nearby.includes(e) ||
            (e.familyId !== undefined && familyIds.has(e.familyId)),
        );
      }
      if (h.specialty === "scout") {
        nearby.forEach((e) => (e.marked = duration));
        if (nearby.length) this.sound("scope", a.pos);
      }
      if (h.specialty === "disrupt")
        nearby
          .filter(
            (e) =>
              ![
                "sleep",
                "budding",
                "burning",
                "falling",
                "poisoned",
                "frightened",
              ].includes(e.state),
          )
          .forEach((e) => {
            e.state = "stunned";
            this.sound("stun", e.pos);
            e.statusTime = duration;
            if (e.familyId !== undefined)
              this.families.get(e.familyId)!.retargetAt = 0;
          });
      if (h.specialty === "bait")
        nearby
          .filter((e) =>
            ["moving", "idle", "hiding", "grouping"].includes(e.state),
          )
          .forEach((e) => {
            e.lureTarget = [...a.pos];
            if (e.familyId !== undefined)
              this.families.get(e.familyId)!.retargetAt = 0;
            else this.wander(e, e.lureTarget);
            e.state = "grouping";
            e.statusTime = duration;
          });
      if (h.specialty === "collector") {
        const eligible = this.drops
          .filter((d) => distance(d.pos, a.pos) <= radius)
          .slice(0, level);
        for (const d of eligible) {
          this.sound("collect", a.pos);
          this.collectorPoints += catalog.headwear.find(
            (h) => h.id === d.hat,
          )!.community_value;
          this.drops = this.drops.filter((x) => x !== d);
        }
      }
    }
  }
  finish(): Result {
    if (this.result) return this.result;
    this.finished = true;
    const g = gradeScore(this.stats, this.mission.max_enemy_count);
    const completed =
      this.stats.kills >= this.mission.max_enemy_count &&
      this.pending.length === 0 &&
      (this.mission.max_collateral_damage < 0 ||
        this.stats.collateral <= this.mission.max_collateral_damage) &&
      this.stats.hits / Math.max(1, this.stats.shots) >=
        this.mission.minimum_accuracy;
    this.result = {
      runId: this.runId,
      missionId: this.mission.id,
      mode: this.mode,
      completed: this.mode === "campaign" && completed,
      ...g,
      workshop:
        this.mode === "campaign"
          ? Math.round(
              ((this.mission.base_reward * this.stats.kills) /
                this.mission.max_enemy_count) *
                (1 + (g.rank - 1) * 0.25),
            )
          : 0,
      community:
        this.mode === "free"
          ? this.pendingPoints + this.collectorPoints - this.reloadSpent
          : 0,
      hats: this.mode === "free" ? { ...this.collected } : {},
      stats: { ...this.stats },
      elapsed: this.elapsed,
    };
    return this.result;
  }
}
