import { expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { rangeMarks } from "../src/render/reticle";
it("標尺由50公尺細分為20公尺，倍率與槍速影響投影", () => {
  const c = new PerspectiveCamera(22, 16 / 9, 0.1, 1000);
  c.updateMatrixWorld();
  const base = rangeMarks(c, 500, [1, 0, 0], false),
    fine = rangeMarks(c, 500, [1, 0, 0], true);
  expect(base).toHaveLength(6);
  expect(fine).toHaveLength(15);
  expect(fine[0].range).toBe(20);
  const y = fine.at(-1)!.y;
  c.fov = 8;
  c.updateProjectionMatrix();
  expect(rangeMarks(c, 500, [1, 0, 0], true).at(-1)!.y).toBeGreaterThan(y);
  expect(rangeMarks(c, 750, [1, 0, 0], true).at(-1)!.y).toBeLessThan(
    rangeMarks(c, 500, [1, 0, 0], true).at(-1)!.y,
  );
});
