import { PerspectiveCamera, Vector3 } from "three";
import { ballisticOffset } from "../game/rules";
import type { V3 } from "../data/content";
export function rangeMarks(
  camera: PerspectiveCamera,
  velocity: number,
  wind: V3,
  upgraded: boolean,
) {
  const result: { range: number; x: number; y: number }[] = [];
  const forward = camera.getWorldDirection(new Vector3());
  for (
    let range = upgraded ? 20 : 50;
    range <= 300;
    range += upgraded ? 20 : 50
  ) {
    const point = camera.position
      .clone()
      .addScaledVector(forward, range)
      .add(new Vector3(...ballisticOffset(range, velocity, wind)))
      .project(camera);
    result.push({ range, x: (point.x + 1) * 50, y: (1 - point.y) * 50 });
  }
  return result;
}
