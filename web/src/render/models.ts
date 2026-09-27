import * as T from "three";
import { species, type SpeciesId } from "../data/content";
import type { State } from "../game/rules";
import { budOrigin, hangingBud, stemPoint } from "../game/budding";
export interface YukkuriModel {
  root: T.Group;
  body: T.Group;
  hat: T.Group;
  hit: T.Mesh;
  expression: (state: State) => void;
  update: (
    time: number,
    state: State,
    deathCause?: "standard" | "poison" | "budding",
    deathAge?: number,
    juvenile?: boolean,
  ) => void;
  setBuds: (count: number, growth: number) => void;
  dispose: () => void;
}
export class ModelLibrary {
  private geometries = new Map<string, T.BufferGeometry>();
  private materials = new Map<string, T.Material>();
  private textures = new Map<string, T.Texture>();
  get resourceCount() {
    return this.geometries.size + this.materials.size + this.textures.size;
  }
  geometry(key: string, make: () => T.BufferGeometry) {
    if (!this.geometries.has(key)) this.geometries.set(key, make());
    return this.geometries.get(key)!;
  }
  material(color: number) {
    const key = String(color);
    if (!this.materials.has(key))
      this.materials.set(key, new T.MeshToonMaterial({ color }));
    return this.materials.get(key)!;
  }
  mesh(
    shape: "ball" | "box" | "cone" | "cylinder" | "torus",
    color: number,
    size: number[],
    pos: number[],
    parent: T.Object3D,
  ) {
    const g = this.geometry(shape, () =>
      shape === "ball"
        ? new T.SphereGeometry(1, 24, 16)
        : shape === "box"
          ? new T.BoxGeometry(1, 1, 1)
          : shape === "cone"
            ? new T.ConeGeometry(1, 1, 24)
            : shape === "cylinder"
              ? new T.CylinderGeometry(1, 1, 1, 24)
              : new T.TorusGeometry(1, 0.08, 8, 40),
    );
    const m = new T.Mesh(g, this.material(color));
    m.scale.set(size[0], size[1], size[2]);
    m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private face(state: State) {
    const key = `face-${["sleep", "stunned", "poisoned", "budding", "frightened", "disposed"].includes(state) ? state : "idle"}`;
    if (this.materials.has(key)) return this.materials.get(key)!;
    let texture: T.CanvasTexture | undefined;
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 320;
      const x = c.getContext("2d")!;
      x.lineCap = "round";
      x.lineJoin = "round";
      x.strokeStyle = "#453039";
      x.fillStyle = "#453039";
      x.lineWidth = 10;
      if (state === "disposed" || state === "poisoned") {
        x.strokeStyle = "#d5cfde";
        x.fillStyle = "#d5cfde";
      }
      for (const side of [155, 357]) {
        if (state === "sleep" || state === "disposed") {
          x.beginPath();
          x.moveTo(side - 33, 126);
          x.quadraticCurveTo(side, 146, side + 33, 126);
          x.stroke();
        } else if (state === "frightened") {
          x.fillStyle = "#fff8e5";
          x.beginPath();
          x.ellipse(side, 125, 28, 42, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "#453039";
          x.beginPath();
          x.ellipse(side, 132, 8, 14, 0, 0, Math.PI * 2);
          x.fill();
          x.beginPath();
          x.moveTo(side - 30, side < 256 ? 67 : 86);
          x.lineTo(side + 30, side < 256 ? 86 : 67);
          x.stroke();
        } else if (state === "stunned" || state === "poisoned") {
          x.beginPath();
          x.moveTo(side - 28, 96);
          x.lineTo(side + 28, 144);
          x.moveTo(side + 28, 96);
          x.lineTo(side - 28, 144);
          x.stroke();
        } else {
          x.beginPath();
          x.ellipse(side, 122, 23, 37, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "#ac6b4d";
          x.beginPath();
          x.ellipse(side, 133, 15, 22, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "#fff8e5";
          x.beginPath();
          x.ellipse(side - 7, 105, 8, 12, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "#453039";
          x.beginPath();
          x.moveTo(side - 29, 83);
          x.quadraticCurveTo(side, 71, side + 27, 85);
          x.stroke();
        }
      }
      x.fillStyle = "rgba(238,123,131,.58)";
      for (const side of [112, 400]) {
        x.beginPath();
        x.ellipse(side, 177, 30, 15, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = "#9b4058";
      if (state === "disposed") {
        x.strokeStyle = "#c4bccb";
        x.beginPath();
        x.moveTo(230, 220);
        x.quadraticCurveTo(256, 198, 282, 220);
        x.stroke();
      } else if (state === "poisoned") {
        x.strokeStyle = "#bc9cc9";
        x.beginPath();
        x.moveTo(218, 213);
        for (let i = 0; i < 6; i++)
          x.lineTo(225 + i * 13, 213 + (i % 2 ? 9 : -9));
        x.stroke();
        x.fillStyle = "#9875bd";
        x.fillRect(165, 48, 9, 40);
        x.fillRect(189, 52, 9, 46);
        x.fillRect(213, 58, 9, 38);
      } else if (state === "frightened" || state === "budding") {
        x.beginPath();
        x.ellipse(256, 210, 20, 27, 0, 0, Math.PI * 2);
        x.fill();
        if (state === "frightened") {
          x.fillStyle = "#91d9ee";
          for (const side of [83, 426]) {
            x.beginPath();
            x.ellipse(side, 119, 10, 23, -0.25, 0, Math.PI * 2);
            x.fill();
          }
        }
      } else {
        x.beginPath();
        x.moveTo(225, 196);
        x.quadraticCurveTo(240, 227, 256, 201);
        x.quadraticCurveTo(272, 227, 287, 196);
        x.stroke();
      }
      texture = new T.CanvasTexture(c);
      texture.colorSpace = T.SRGBColorSpace;
      this.textures.set(key, texture);
    }
    const m = new T.MeshBasicMaterial({
      map: texture ?? null,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.materials.set(key, m);
    return m;
  }
  private bow(
    parent: T.Object3D,
    color: number,
    scale: number,
    x: number,
    y: number,
    z: number,
    white = false,
  ) {
    const group = new T.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const g = this.geometry("ribbon", () => {
      const s = new T.Shape();
      s.moveTo(0.04, 0);
      s.lineTo(0.68, 0.34);
      s.quadraticCurveTo(0.87, 0.05, 0.64, -0.31);
      s.lineTo(0.04, 0);
      return new T.ExtrudeGeometry(s, {
        depth: 0.15,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.035,
      });
    });
    for (const side of [-1, 1]) {
      const m = new T.Mesh(g, this.material(color));
      m.scale.x = side;
      group.add(m);
      if (white) {
        const seam = this.mesh(
          "box",
          0xfff1df,
          [0.08, 0.43, 0.04],
          [side * 0.64, 0.02, 0.2],
          group,
        );
        seam.rotation.z = side * 0.15;
      }
      const tail = this.mesh(
        "box",
        color,
        [0.23, 0.53, 0.12],
        [side * 0.22, -0.34, 0.05],
        group,
      );
      tail.rotation.z = side * 0.3;
    }
    this.mesh("ball", color, [0.18, 0.17, 0.16], [0, 0, 0.1], group);
    return group;
  }
  create(id: SpeciesId, helper = false): YukkuriModel {
    const s = species.find((s) => s.id === id)!;
    const root = new T.Group(),
      body = new T.Group(),
      hat = new T.Group();
    root.name = `yukkuri-${id}`;
    root.add(body);
    body.add(hat);
    hat.name = "HatSocket";
    hat.position.y = id === "marisa" ? 1.8 : 1.58;
    const skin = this.mesh(
      "ball",
      0xffe6ba,
      [1.02, 0.79, 0.85],
      [0, 0.88, 0],
      body,
    );
    const cap = this.geometry(
      "hair-cap",
      () => new T.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, 1.4),
    );
    const hair = new T.Mesh(cap, this.material(s.hair));
    hair.position.y = 0.97;
    hair.scale.set(1.05, 0.82, 0.87);
    body.add(hair);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.235;
      const lock = this.mesh(
        "ball",
        s.hair,
        [0.19, 0.31, 0.15],
        [
          x,
          1.46 - Math.abs(i - 3) * 0.025,
          0.68 + (0.12 - Math.abs(i - 3) * 0.04),
        ],
        body,
      );
      lock.rotation.z = (i - 3) * -0.16;
    }
    for (const side of [-1, 1]) {
      const long = id === "patchouli" || id === "reimu";
      const lock = this.mesh(
        "ball",
        s.hair,
        [0.21, long ? 0.6 : 0.36, 0.36],
        [side * 0.9, long ? 0.81 : 1.0, 0.13],
        body,
      );
      lock.rotation.z = side * 0.1;
      if (id === "reimu") {
        this.mesh(
          "cylinder",
          0xd64957,
          [0.19, 0.14, 0.19],
          [side * 0.92, 0.47, 0.15],
          body,
        );
        this.mesh(
          "ball",
          s.hair,
          [0.19, 0.24, 0.24],
          [side * 0.93, 0.27, 0.14],
          body,
        );
      }
    }
    const f = new T.Mesh(
      this.geometry("face-plane", () => new T.PlaneGeometry(1.7, 1.03)),
      this.face("idle"),
    );
    f.position.set(0, 0.94, 0.841);
    body.add(f);
    if (id === "reimu") this.bow(hat, s.accent, 1.08, 0, 0.28, 0.03, true);
    if (id === "marisa") {
      this.mesh("cylinder", 0x343042, [1.26, 0.09, 0.88], [0, 0.06, 0], hat);
      const cone = this.mesh(
        "cone",
        0x393345,
        [0.79, 1.19, 0.7],
        [-0.07, 0.63, -0.04],
        hat,
      );
      cone.rotation.z = 0.14;
      this.mesh("cylinder", 0xfff2dc, [0.68, 0.18, 0.62], [0, 0.25, 0.02], hat);
      this.bow(hat, 0xfff2dc, 0.6, 0.52, 0.36, 0.51);
      for (let j = 0; j < 4; j++)
        this.mesh(
          "ball",
          s.hair,
          [0.23 - j * 0.025, 0.19, 0.22],
          [0.93 + j * 0.018, 0.8 - j * 0.19, 0.22],
          body,
        );
      this.bow(body, 0xeee5ce, 0.23, 1, 0.15, 0.25);
    }
    if (id === "alice") {
      const band = this.geometry(
        "hair-band",
        () => new T.TorusGeometry(0.98, 0.075, 8, 36, Math.PI),
      );
      const m = new T.Mesh(band, this.material(s.accent));
      m.rotation.z = 0;
      m.position.set(0, -0.52, 0);
      hat.add(m);
      this.bow(hat, s.accent, 0.4, 0.77, 0.04, 0.09);
    }
    if (id === "patchouli") {
      this.mesh("ball", 0xe5bbd9, [0.97, 0.29, 0.82], [0, 0.18, 0], hat);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        this.mesh(
          "ball",
          0xf2d5e5,
          [0.18, 0.13, 0.18],
          [Math.cos(a) * 0.9, 0.04, Math.sin(a) * 0.74],
          hat,
        );
      }
      const moonShape = this.geometry("moon", () => {
        const sh = new T.Shape();
        const ix = (0.2 ** 2 - 0.18 ** 2 + 0.09 ** 2) / 0.18;
        const iy = Math.sqrt(0.2 ** 2 - ix ** 2);
        const outer = Math.atan2(iy, ix);
        const inner = Math.atan2(iy, ix - 0.09);
        sh.absarc(0, 0, 0.2, outer, Math.PI * 2 - outer, false);
        sh.absarc(0.09, 0, 0.18, Math.PI * 2 - inner, inner, true);
        return new T.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: false });
      });
      const moon = new T.Mesh(moonShape, this.material(0xffd773));
      moon.position.set(0, 0.19, 0.8);
      hat.add(moon);
      this.bow(hat, 0x8663b4, 0.45, -0.7, 0.08, 0.43);
      this.bow(hat, 0xb35479, 0.4, 0.7, 0.08, 0.43);
    }
    if (id === "chen") {
      for (const side of [-1, 1]) {
        const ear = this.mesh(
          "cone",
          s.hair,
          [0.31, 0.72, 0.24],
          [side * 0.76, 0.25, -0.05],
          hat,
        );
        ear.rotation.z = side * -0.25;
        const inside = this.mesh(
          "cone",
          0xe6ab99,
          [0.17, 0.43, 0.055],
          [side * 0.76, 0.29, 0.165],
          hat,
        );
        inside.rotation.z = side * -0.25;
      }
      this.mesh("ball", 0x428d78, [0.72, 0.27, 0.62], [0, 0.18, 0.07], hat);
      this.mesh(
        "torus",
        0xefe3af,
        [0.68, 0.26, 0.62],
        [0, 0.15, 0.07],
        hat,
      ).rotation.x = Math.PI / 2;
      this.mesh("ball", 0xe4c36d, [0.1, 0.1, 0.1], [0.33, 0.3, 0.62], hat);
    }
    if (id === "youmu") this.bow(hat, 0x2e3540, 0.75, 0.44, 0.12, 0.13);
    if (helper) {
      // 正面看右上方；依各頭飾表面貼附，避開中央裝飾與臉部。
      const badgePositions: Record<SpeciesId, [number, number, number]> = {
        reimu: [0.65, 0.48, 0.29],
        marisa: [0.82, 0.49, 0.65],
        alice: [0.98, 0.15, 0.19],
        patchouli: [0.57, 0.3, 0.63],
        chen: [0.43, 0.34, 0.48],
        youmu: [0.84, 0.27, 0.31],
      };
      const [x, y, z] = badgePositions[id];
      const radius = id === "alice" ? 0.13 : 0.17;
      const badge = this.mesh(
        "cylinder",
        0x38c895,
        [radius, 0.07, radius],
        [x, y, z],
        hat,
      );
      badge.rotation.x = Math.PI / 2;
      badge.name = "community-badge";
      this.mesh("ball", 0xf7f5cc, [0.05, 0.05, 0.028], [x, y, z + 0.045], hat);
    }
    const hit = new T.Mesh(
      this.geometry("hit", () => new T.SphereGeometry(1, 12, 8)),
      this.material(0xffffff),
    );
    hit.position.y = 0.85;
    hit.scale.set(1.03, 0.83, 0.85);
    hit.visible = false;
    hit.userData.actorProxy = true;
    root.add(hit);
    const sprout = new T.Group();
    sprout.visible = false;
    sprout.name = "budding-stem";
    sprout.position.set(...budOrigin);
    body.add(sprout);
    const stem = new T.Mesh(
      this.geometry(
        "forward-budding-stem",
        () =>
          new T.TubeGeometry(
            new T.QuadraticBezierCurve3(
              new T.Vector3(),
              new T.Vector3(0, 0.55, 1.1),
              new T.Vector3(...stemPoint(1)),
            ),
            16,
            0.035,
            6,
            false,
          ),
      ),
      this.material(0x4f9b56),
    );
    sprout.add(stem);
    for (const side of [-1, 1]) {
      const leaf = this.mesh(
        "ball",
        0x8acb68,
        [0.22, 0.07, 0.09],
        [side * 0.13, 0.22, 0.55],
        sprout,
      );
      leaf.rotation.z = side * 0.35;
    }
    const thisLib = this;
    const babies: YukkuriModel[] = [];
    let expression: State = "idle";
    return {
      root,
      body,
      hat,
      hit,
      setBuds(count, growth) {
        count = Math.max(0, Math.min(3, count));
        while (babies.length > count) babies.pop()!.dispose();
        while (babies.length < count) {
          const child = thisLib.create(id);
          child.root.name = "hanging-yukkuri";
          child.root.scale.setScalar(0.3);
          child.hit.userData.actorProxy = false;
          sprout.add(child.root);
          babies.push(child);
        }
        babies.forEach((child, i) =>
          child.root.position.set(...hangingBud(i, count)),
        );
        sprout.visible = count > 0;
        sprout.scale.setScalar(Math.max(0.01, Math.min(1, growth)));
      },
      expression(state) {
        if (state !== expression) {
          expression = state;
          f.material = thisLib.face(state);
        }
      },
      update(time, state, deathCause, deathAge = 1, juvenile = false) {
        const moving = ["moving", "frightened", "grouping"].includes(state),
          b = moving
            ? Math.abs(Math.sin(time * (state === "frightened" ? 11 : 5.5))) *
              0.14
            : Math.sin(time * 2) * 0.015;
        body.position.y = b;
        body.position.x = state === "budding" && juvenile ? Math.sin(time * 31) * 0.035 : 0;
        body.scale.set(1 - b * 0.25, 1 + b * 0.25, 1 - b * 0.25);
        skin.material = thisLib.material(
          state === "burning"
            ? 0xf13732
            : state === "disposed"
              ? 0x503326
              : state === "poisoned"
                ? 0x66516d
                : 0xffe6ba,
        );
        if (state === "burning") {
          const pulse = 1.1 + Math.sin(time * 30) * 0.045;
          body.scale.set(pulse, pulse, pulse);
          this.expression("frightened");
        }
        if (state === "disposed") {
          const t = Math.max(0, Math.min(1, deathAge));
          // 平滑失去支撐：先變扁橢圓，再向外攤開，沒有彈回。
          const collapse = t * t * (3 - 2 * t);
          body.scale.set(
            1 + 0.32 * collapse,
            1 - 0.76 * collapse,
            1 + 0.24 * collapse,
          );
          body.position.y = 0.02 * collapse;
          f.scale.y = 1 + 0.7 * collapse;
        } else {
          f.scale.y = 1;
        }
        if (state === "budding" && juvenile)
          body.rotation.z = Math.sin(time * 25) * 0.045;
        else if (state === "poisoned") body.rotation.z = Math.sin(time * 24) * 0.025;
        else body.rotation.z = 0;
        if (state !== "burning")
          this.expression(
            state === "disposed" && deathCause === "poison"
              ? "poisoned"
              : state,
          );
        babies.forEach((child) =>
          child.update(
            time,
            state === "disposed" && deathCause === "budding"
              ? "disposed"
              : "idle",
            deathCause,
            deathAge,
          ),
        );
      },
      dispose() {
        babies.forEach((child) => child.dispose());
        babies.length = 0;
        root.removeFromParent();
        root.clear();
      },
    };
  }
  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}
