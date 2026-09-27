import { it, expect } from "vitest";
import { Box3, Vector3, Mesh, MeshStandardMaterial } from "three";
import { ModelLibrary } from "../src/render/models";
import { species } from "../src/data/content";
it('死亡在一秒內連續攤平，結束後保持相同姿勢',()=>{
 const lib=new ModelLibrary(),m=lib.create('reimu');let lastHeight=1,lastWidth=1;
 for(const age of [0,.1,.25,.5,.75,1]) {
  m.update(3,'disposed','poison',age);
  expect(m.body.scale.y).toBeLessThanOrEqual(lastHeight);expect(m.body.scale.x).toBeGreaterThanOrEqual(lastWidth);
  lastHeight=m.body.scale.y;lastWidth=m.body.scale.x;
 }
 expect(lastHeight).toBeCloseTo(.24);const final=m.body.scale.clone();
 m.update(40,'disposed','poison',30);expect(m.body.scale).toEqual(final);m.dispose();lib.dispose();
});
it("六種完整立體模型都有頭飾、命中代理與協力者徽章", () => {
  const lib = new ModelLibrary();
  for (const s of species) {
    const m = lib.create(s.id, true);
    expect(m.root.getObjectByName("community-badge")).toBeTruthy();
    expect(m.hat.children.length).toBeGreaterThan(0);
    expect(m.hit.userData.actorProxy).toBe(true);
    const size = new Box3().setFromObject(m.root).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(1.5);
    expect(size.y).toBeGreaterThan(1);
    m.expression("sleep");
    m.update(1, "moving");
    m.dispose();
  }
  lib.dispose();
});
it("複用模型不造成幾何快取無限成長", () => {
  const lib = new ModelLibrary();
  for (let i = 0; i < 6; i++) lib.create(species[i].id).dispose();
  const before = lib.resourceCount;
  for (let i = 0; i < 200; i++) lib.create(species[i % 6].id).dispose();
  expect(lib.resourceCount).toEqual(before);
  lib.dispose();
  expect(lib.resourceCount).toBe(0);
});
it("芽殖掛載數量一致、重複生長可回收，變紅不影響其他個體", () => {
  const lib = new ModelLibrary(),
    mother = lib.create("reimu"),
    other = lib.create("reimu");
  mother.update(1, "burning");
  other.update(1, "idle");
  const red = mother.body.children.filter(
    (c) =>
      c instanceof Mesh &&
      (c.material as MeshStandardMaterial).color?.getHex() === 0xf13732,
  );
  expect(red).toHaveLength(1);
  expect(
    other.body.children.some(
      (c) => c instanceof Mesh && c.material === (red[0] as Mesh).material,
    ),
  ).toBe(false);
  mother.setBuds(3, 1);
  const stem = mother.root.getObjectByName("budding-stem")!;
  const mounted = () =>
    stem.children.filter((c) => c.name === "hanging-yukkuri");
  expect(mounted()).toHaveLength(3);
  const resources = lib.resourceCount;
  for (let i = 0; i < 100; i++) {
    mother.setBuds(0, 1);
    mother.setBuds(3, 1);
  }
  expect(lib.resourceCount).toBe(resources);
  mother.setBuds(0, 1);
  expect(mounted()).toHaveLength(0);
  expect(stem.visible).toBe(false);
  mother.dispose();
  other.dispose();
  lib.dispose();
  expect(lib.resourceCount).toBe(0);
});
