import * as T from "three";
import { ModelLibrary } from "./models";
import type { MapId } from "../data/content";
export interface World {
  root: T.Group;
  colliders: T.Object3D[];
  camera: T.Vector3;
  look: T.Vector3;
  dispose: () => void;
}
export const palettes: Record<
  MapId,
  { sky: number; ground: number; accent: number; label: string }
> = {
  park: {
    sky: 0xd1e5dd,
    ground: 0x8cac78,
    accent: 0xe6a554,
    label: "青葉公園",
  },
  city: { sky: 0xbfcfd5, ground: 0x899694, accent: 0xe8ae73, label: "市中心" },
  residential: {
    sky: 0xf2dcc6,
    ground: 0x98ac87,
    accent: 0xce7661,
    label: "住宅區",
  },
  shopping_street: {
    sky: 0xe8d9c4,
    ground: 0xc5bba4,
    accent: 0x538c80,
    label: "商店街",
  },
  factory: {
    sky: 0xc9d6d7,
    ground: 0xa2a597,
    accent: 0xd99752,
    label: "工廠區",
  },
  rural: {
    sky: 0xd6e7ca,
    ground: 0x95b26a,
    accent: 0xc79b60,
    label: "山麓農村",
  },
  joint: {
    sky: 0xc2d5cd,
    ground: 0x91a082,
    accent: 0xe2ac64,
    label: "聯合管制區",
  },
};
export function buildWorld(lib: ModelLibrary, map: MapId): World {
  const root = new T.Group(),
    colliders: T.Object3D[] = [],
    extras: T.Texture[] = [];
  const p = palettes[map];
  const mesh = (
    shape: "box" | "ball" | "cylinder" | "cone" | "torus",
    color: number,
    size: number[],
    pos: number[],
    solid = true,
  ) => {
    const m = lib.mesh(shape, color, size, pos, root);
    if (solid) {
      m.userData.collateral = true;
      colliders.push(m);
    }
    return m;
  };
  const box = (color: number, size: number[], pos: number[], solid = true) =>
    mesh("box", color, size, pos, solid);
  const ground = box(p.ground, [100, 0.5, 112], [0, -0.3, -22], false);
  ground.userData.ground = true;
  colliders.push(ground);
  // Broad crossing walkways leave clearly readable ground patrol routes.
  for (const x of [-25, -9, 7, 23])
    box(0xc6c4a9, [3, 0.06, 64], [x, 0, -23], false);
  for (const z of [-2, -18, -34, -50])
    box(0xd8cbb0, [57, 0.075, 2.7], [0, 0.015, z], false);
  const tileGeo = lib.geometry(
    "paving-tile",
    () => new T.BoxGeometry(0.95, 0.05, 0.55),
  );
  const tiles = new T.InstancedMesh(tileGeo, lib.material(0xddd3b8), 120);
  const matrix = new T.Matrix4();
  for (let i = 0; i < 120; i++)
    tiles.setMatrixAt(
      i,
      matrix.makeTranslation(
        -28 + (i % 40) * 1.4,
        0.075,
        -1.25 - Math.floor(i / 40) * 0.8,
      ),
    );
  tiles.receiveShadow = true;
  root.add(tiles);
  const tree = (x: number, z: number, scale = 1) => {
    mesh("cylinder", 0x79634b, [0.28, 3.7, 0.28], [x, 1.85, z]);
    mesh(
      "ball",
      0x5e8861,
      [2.4 * scale, 2.8 * scale, 2.4 * scale],
      [x, 4.4, z],
      false,
    );
    mesh(
      "ball",
      0x789d67,
      [1.8 * scale, 2.1 * scale, 1.8 * scale],
      [x - 0.8, 5.4, z + 0.25],
      false,
    );
  };
  const bench = (x: number, z: number) => {
    for (let i = 0; i < 4; i++)
      box(0xb88955, [3.8, 0.12, 0.17], [x, 0.83, z + i * 0.22]);
    for (let i = 0; i < 3; i++)
      box(0xb88955, [3.8, 0.15, 0.14], [x, 1.1 + i * 0.22, z - 0.08]);
    for (const side of [-1, 1]) {
      box(0x42595b, [0.12, 0.9, 0.8], [x + side * 1.5, 0.45, z + 0.3]);
      box(0x42595b, [0.12, 1.4, 0.13], [x + side * 1.5, 0.7, z - 0.1]);
    }
  };
  const building = (
    x: number,
    z: number,
    w: number,
    h: number,
    color: number,
  ) => {
    box(color, [w, h, 8], [x, h / 2, z]);
    box(0x50696a, [w + 0.4, 0.35, 8.4], [x, h + 0.1, z]);
    for (let floor = 0; floor < Math.floor(h / 2.5); floor++)
      for (let c = 0; c < 3; c++) {
        box(
          0x66868d,
          [1.2, 1.1, 0.08],
          [x - w * 0.32 + c * w * 0.32, 1.6 + floor * 2.5, z + 4.05],
        );
        box(
          0xe1ddc6,
          [1.4, 0.1, 0.18],
          [x - w * 0.32 + c * w * 0.32, 1 + floor * 2.5, z + 4.15],
        );
      }
  };
  const shrub = (x: number, z: number) => {
    for (let i = 0; i < 3; i++)
      mesh(
        "ball",
        i % 2 ? 0x638953 : 0x799958,
        [1, 0.7, 0.8],
        [x + i * 0.7, 0.45, z],
        false,
      );
  };
  const sign = (text: string, x: number, y: number, z: number) => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#294b45";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#e6d8b7";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = "#f7edce";
    ctx.font = "bold 54px Microsoft JhengHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 84);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    extras.push(texture);
    const mat = new T.MeshBasicMaterial({ map: texture });
    const m = new T.Mesh(
      lib.geometry("sign-plane", () => new T.PlaneGeometry(6, 1.5)),
      mat,
    );
    m.position.set(x, y, z);
    root.add(m);
    extraMaterials.push(mat);
  };
  const extraMaterials: T.Material[] = [];
  for (let i = 0; i < 9; i++) {
    tree(-32, -4 - i * 6, 0.9);
    tree(32, -i * 7, 1);
  }
  for (let i = 0; i < 9; i++) {
    const m = mesh(
      "cone",
      i % 2 ? 0x7e9985 : 0x90aa94,
      [12, 16 + (i % 3) * 5, 8],
      [-52 + i * 13, 4, -78],
      false,
    );
    m.rotation.y = i * 0.7;
  }
  for (const x of [-29, 29]) {
    box(0x9a977d, [0.25, 1.1, 62], [x, 0.55, -23]);
    for (let z = 5; z > -53; z -= 3)
      box(0xd0c5a4, [0.18, 1.8, 0.18], [x, 0.9, z]);
  }
  if (map === "park" || map === "joint") {
    bench(-16, -12);
    bench(1, -28);
    bench(15, -44);
    shrub(-14, -15);
    shrub(1, -31);
    for (const x of [11, 17]) {
      box(0xe3b161, [0.22, 4, 0.22], [x, 2, -12]);
      box(0xe3b161, [0.22, 4, 0.22], [x, 2, -16]);
    }
    box(0x6a8581, [6.5, 0.25, 4.5], [14, 4, -14]);
    for (const x of [13, 15]) {
      box(0x576d6b, [0.035, 2.6, 0.035], [x, 2.55, -12]);
      box(0x576d6b, [0.035, 2.6, 0.035], [x, 2.55, -14]);
      box(0xd7805b, [1, 0.15, 2], [x, 1.2, -13]);
    }
    const slide = box(0xe2a857, [2, 0.13, 5], [-14, 1.1, -30]);
    slide.rotation.x = 0.35;
    mesh("cylinder", 0x598d7b, [0.7, 1.5, 0.7], [-20, 0.75, -11]);
    sign("青 葉 公 園", 0, 3, -54);
  }
  if (map === "city" || map === "joint") {
    for (let i = 0; i < 5; i++)
      building(
        -23 + i * 11,
        -58,
        9,
        9 + (i % 3) * 4,
        [0xd9cbb3, 0xc5bea5, 0xa9b8b1][i % 3],
      );
    for (const [x, z] of [
      [-16, -12],
      [2, -28],
      [18, -43],
    ]) {
      box(0x587c75, [3, 1.6, 1.7], [x, 0.8, z]);
      box(0x3d5954, [3.3, 0.15, 2], [x, 1.65, z]);
      box(0xd5d4bd, [2.4, 1.4, 1], [x + 4, 0.7, z]);
      mesh("torus", 0x6b7a79, [0.45, 0.45, 0.45], [x + 4, 0.8, z + 0.52]);
    }
    sign("中央通り", 0, 4, -53);
  }
  if (map === "residential") {
    for (let i = 0; i < 5; i++) {
      const x = -22 + i * 11;
      building(x, -57, 8, 5, i % 2 ? 0xe4c6ab : 0xd4d8bc);
      const roof = mesh("cone", 0xa66854, [6, 3, 6], [x, 6.5, -57]);
      roof.rotation.y = Math.PI / 4;
      shrub(x - 3, -48);
    }
    for (const [x, z] of [
      [-15, -12],
      [1, -28],
      [16, -44],
    ]) {
      box(0xe4d5bb, [4, 1.1, 0.4], [x, 0.55, z]);
      mesh("cylinder", 0xbe8263, [0.6, 0.8, 0.6], [x + 3, 0.4, z]);
      mesh("ball", 0x6b976a, [0.9, 0.8, 0.9], [x + 3, 1.1, z], false);
    }
    sign("みどり住宅区", 0, 2.8, -52);
  }
  if (map === "shopping_street") {
    for (let i = 0; i < 5; i++) {
      const x = -22 + i * 11;
      building(x, -55, 10, 6, i % 2 ? 0xe6bd99 : 0xc5d5c2);
      box(i % 2 ? 0xbf6e56 : 0x568b7a, [10, 0.2, 5], [x, 3.5, -49]);
      for (let k = 0; k < 5; k++)
        box(0xf4dfbb, [1, 0.22, 5], [x - 4 + k * 2, 3.52, -49]);
      sign(
        ["青葉商店", "喫茶 こもれび", "日用品", "花と緑", "菓子工房"][i],
        x,
        5,
        -50.9,
      );
    }
    for (const [x, z] of [
      [-14, -12],
      [2, -28],
      [18, -44],
    ]) {
      box(0xaf885b, [3, 1.2, 1.5], [x, 0.6, z]);
      for (let j = 0; j < 5; j++)
        mesh(
          "ball",
          0xe3a95d,
          [0.28, 0.28, 0.28],
          [x - 1 + j * 0.5, 1.4, z],
          false,
        );
    }
  }
  if (map === "factory") {
    building(-14, -56, 23, 9, 0xc5bca3);
    building(14, -56, 23, 8, 0xaebbb2);
    for (const [x, z] of [
      [-15, -12],
      [1, -28],
      [17, -44],
    ]) {
      box(0x677f7a, [5, 0.45, 2], [x, 1.2, z]);
      for (const side of [-1, 1])
        box(0x4b605e, [0.3, 1.2, 1.8], [x + side * 2, 0.6, z]);
      for (let i = 0; i < 6; i++) {
        const r = mesh(
          "cylinder",
          0x87978d,
          [0.16, 1.8, 0.16],
          [x - 2 + i * 0.8, 1.5, z],
        );
        r.rotation.x = Math.PI / 2;
      }
      box(0xce9f64, [1.4, 1.2, 1.2], [x, 2, z]);
    }
    for (const x of [-25, 25]) {
      mesh("cylinder", 0xabb8ad, [2, 8, 2], [x, 4, -47]);
      mesh("cylinder", 0x796f5f, [0.6, 13, 0.6], [x, 6.5, -53]);
    }
    sign("青葉加工所　第二工場", 0, 6, -51.8);
  }
  if (map === "rural") {
    for (let row = 0; row < 6; row++) {
      box(
        0xb6a06b,
        [52, 0.3 + row * 0.35, 7],
        [-1, row * 0.175 - 0.1, -7 - row * 8],
        false,
      );
      for (let j = 0; j < 8; j++)
        box(
          0x76974c,
          [5, 0.11, 0.23],
          [-20 + j * 6, row * 0.35 + 0.12, -10 - row * 8],
          false,
        );
    }
    building(-14, -57, 10, 4, 0xbc9b6a);
    const roof = mesh("cone", 0x685a47, [8, 3, 7], [-14, 5.5, -57]);
    roof.rotation.y = Math.PI / 4;
    for (const [x, z] of [
      [-15, -12],
      [1, -28],
      [17, -44],
    ]) {
      box(0xab8854, [3, 1.2, 2], [x, 1, z]);
      tree(x + 4, z - 3, 0.65);
    }
    sign("山麓の棚田", 8, 3, -53);
  }
  // Observation deck and a procedural rifle, entirely native geometry.
  box(0x7b8170, [8, 0.5, 6], [0, 10.5, 29], false);
  box(0x69766b, [8, 1, 0.4], [0, 11, 26.3], false);
  return {
    root,
    colliders,
    camera: new T.Vector3(0, 12.4, 28),
    look: new T.Vector3(0, 0.7, -19),
    dispose() {
      root.removeFromParent();
      extras.forEach((t) => t.dispose());
      extraMaterials.forEach((m) => m.dispose());
      tiles.dispose();
      root.clear();
    },
  };
}
