import type { V3 } from "../data/content";
export type SoundName =
  | "standard"
  | "chili"
  | "coffee"
  | "marble_soda"
  | "budding"
  | "impact"
  | "ricochet"
  | "empty"
  | "reloadOut"
  | "reloadIn"
  | "reloadReady"
  | "ignite"
  | "explode"
  | "grow"
  | "birth"
  | "land"
  | "sleep"
  | "stun"
  | "wake"
  | "collect"
  | "warning"
  | "scope"
  | "zoom"
  | "ammo"
  | "click"
  | "success"
  | "failure"
  | "deploy"
  | "hop"
  | "wind"
  | "bird"
  | "machine";
export interface SoundEvent {
  name: SoundName;
  pos?: V3;
}
