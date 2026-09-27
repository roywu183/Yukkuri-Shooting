import * as T from "three";
import { ModelLibrary, type YukkuriModel } from "./models";
import { buildWorld, palettes, type World } from "./world";
import { Session, ballisticOffset, type Actor } from "../game/rules";
import { species, type MapId } from "../data/content";
export class GameView {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(55, 1, 0.08, 240);
  lib = new ModelLibrary();
  world?: World;
  models = new Map<number, YukkuriModel>();
  dropModels = new Map<number, T.Group>();
  private fragmentMesh!: T.InstancedMesh;
  private burstMesh!: T.InstancedMesh;
  ray = new T.Raycaster();
  yaw = 0;
  pitch = -0.24;
  scope = false;
  zoom = 0;
  gallery = false;
  galleryAngle = 0;
  gun = new T.Group();
  markerRoot = new T.Group();
  fps = 60;
  private frames: number[] = [];
  private galleryModels: YukkuriModel[] = [];
  private markerGeometry = new T.BufferGeometry();
  private markerMaterial = new T.LineBasicMaterial({ color: 0x5cebc0 });
  private markers = new T.LineSegments(
    this.markerGeometry,
    this.markerMaterial,
  );
  private tracer = new T.Line(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({
      color: 0xffe4a0,
      transparent: true,
      opacity: 0.8,
    }),
  );
  private lastShot = -1;
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.scene.add(new T.HemisphereLight(0xfff6df, 0x688671, 1.8));
    const sun = new T.DirectionalLight(0xffe6bd, 2.5);
    sun.position.set(-25, 40, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 65;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.far = 130;
    sun.shadow.normalBias = 0.035;
    sun.target.position.set(0, 0, -20);
    this.scene.add(sun, sun.target, this.camera, this.markers, this.tracer);
    this.buildGun();
    this.fragmentMesh = new T.InstancedMesh(
      this.lib.geometry("meat-fragment", () => new T.IcosahedronGeometry(1, 0)),
      this.lib.material(0xe86b68),
      768,
    );
    this.burstMesh = new T.InstancedMesh(
      this.lib.geometry("burst-sphere", () => new T.SphereGeometry(1, 12, 8)),
      new T.MeshBasicMaterial({
        color: 0xffba76,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
      64,
    );
    for (const effect of [this.fragmentMesh, this.burstMesh]) {
      effect.count = 0;
      effect.frustumCulled = false;
      effect.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.scene.add(effect);
    }
    this.camera.add(this.gun);
    this.resize();
  }
  private buildGun() {
    const l = this.lib;
    l.mesh("box", 0x9b7955, [0.1, 0.12, 0.56], [0.25, -0.21, -0.45], this.gun);
    const barrel = l.mesh(
      "cylinder",
      0x40504e,
      [0.024, 0.65, 0.024],
      [0.25, -0.17, -0.83],
      this.gun,
    );
    barrel.rotation.x = Math.PI / 2;
    const scope = l.mesh(
      "cylinder",
      0x364541,
      [0.046, 0.3, 0.046],
      [0.25, -0.1, -0.5],
      this.gun,
    );
    scope.rotation.x = Math.PI / 2;
    l.mesh("box", 0x394b46, [0.08, 0.15, 0.1], [0.25, -0.27, -0.47], this.gun);
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setMap(map: MapId) {
    this.clearActors();
    this.world?.dispose();
    this.world = buildWorld(this.lib, map);
    this.scene.add(this.world.root);
    this.scene.background = new T.Color(palettes[map].sky);
    this.scene.fog = new T.Fog(palettes[map].sky, 55, 145);
    this.camera.position.copy(this.world.camera);
    this.camera.lookAt(this.world.look);
    this.camera.rotation.order = "YXZ";
    this.pitch = this.camera.rotation.x;
    this.yaw = this.camera.rotation.y;
    this.scope = false;
    this.gallery = false;
    this.gun.visible = true;
  }
  private clearActors() {
    this.fragmentMesh.count = 0;
    this.burstMesh.count = 0;
    this.models.forEach((m) => m.dispose());
    this.models.clear();
    this.dropModels.forEach((g) => g.removeFromParent());
    this.dropModels.clear();
    this.galleryModels.forEach((m) => m.dispose());
    this.galleryModels = [];
  }
  showGallery(helper = false) {
    this.setMap("park");
    this.gallery = true;
    this.gun.visible = false;
    for (let i = 0; i < 6; i++) {
      const m = this.lib.create(species[i].id, helper);
      m.root.position.set(((i % 3) - 1) * 3.5, 0, -Math.floor(i / 3) * 4.7);
      this.scene.add(m.root);
      this.galleryModels.push(m);
    }
    this.camera.position.set(6, 6, 12);
    this.camera.lookAt(0, 0.8, -2);
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
  }
  aim(dx: number, dy: number) {
    this.yaw -= dx * (this.scope ? 0.0009 : 0.002);
    this.pitch = T.MathUtils.clamp(
      this.pitch - dy * (this.scope ? 0.0009 : 0.002),
      -0.95,
      0.12,
    );
  }
  sync(s: Session, dt: number, active = true) {
    if (!this.world) return;
    const ids = new Set([...s.enemies, ...s.helpers].map((a) => a.id));
    for (const [id, m] of this.models)
      if (!ids.has(id)) {
        m.dispose();
        this.models.delete(id);
      }
    for (const a of [...s.enemies, ...s.helpers]) {
      let m = this.models.get(a.id);
      if (!m) {
        m = this.lib.create(a.species, a.helper);
        m.hit.userData.actorId = a.id;
        this.models.set(a.id, m);
        this.scene.add(m.root);
      }
      m.root.position.set(...a.pos);
      m.root.visible = !a.exploded;
      m.root.scale.setScalar(a.scale);
      const next = a.route[a.waypoint % a.route.length];
      const targetAngle = Math.atan2(next[0] - a.pos[0], next[2] - a.pos[2]);
      if (["moving", "frightened", "grouping"].includes(a.state)) {
        const turn = targetAngle - m.root.rotation.y;
        m.root.rotation.y +=
          Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 4);
      }
      if (s.pending.some((p) => p.parentId === a.id))
        m.root.rotation.y = a.budYaw ?? m.root.rotation.y;
      m.update(
        s.elapsed + a.phase,
        a.state,
        a.deathCause,
        s.elapsed - (a.deathAt ?? s.elapsed),
      );
      m.setBuds(
        s.pending.filter((p) => p.parentId === a.id).length,
        (s.elapsed - (a.budStarted ?? s.elapsed)) / 0.8,
      );
    }
    const dummy = new T.Object3D();
    this.fragmentMesh.count = s.fragments.length;
    s.fragments.forEach((f, i) => {
      dummy.position.set(...f.pos);
      dummy.rotation.set(f.age * 9 + f.id, f.age * 6, f.age * 5);
      dummy.scale.set(0.2, 0.075, 0.13);
      dummy.updateMatrix();
      this.fragmentMesh.setMatrixAt(i, dummy.matrix);
    });
    this.fragmentMesh.instanceMatrix.needsUpdate = true;
    const flashes = s.bursts.filter((b) => b.age < 0.3);
    this.burstMesh.count = flashes.length;
    flashes.forEach((b, i) => {
      dummy.position.set(...b.pos);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar((0.5 + b.age * 5) * b.scale);
      dummy.updateMatrix();
      this.burstMesh.setMatrixAt(i, dummy.matrix);
    });
    this.burstMesh.instanceMatrix.needsUpdate = true;
    const dropIds = new Set(s.drops.map((d) => d.id));
    for (const [id, g] of this.dropModels)
      if (!dropIds.has(id)) {
        g.removeFromParent();
        this.dropModels.delete(id);
      }
    for (const d of s.drops) {
      let g = this.dropModels.get(d.id);
      if (!g) {
        const temp = this.lib.create(d.species);
        g = temp.hat;
        g.removeFromParent();
        temp.dispose();
        this.scene.add(g);
        this.dropModels.set(d.id, g);
      }
      g.position.set(d.pos[0], d.pos[1] + 0.17, d.pos[2]);
      g.scale.setScalar(0.55);
      g.rotation.y = s.elapsed * 0.25;
    }
    if (active) {
      const sway = (this.scope ? 0.0007 : 0.001) * s.equip.sway;
      this.camera.rotation.set(
        this.pitch + Math.sin(s.elapsed * 1.7) * sway,
        this.yaw + Math.sin(s.elapsed * 1.1) * sway,
        0,
        "YXZ",
      );
      this.camera.fov = this.scope
        ? [22, 14, 8][this.zoom] * s.equip.scope
        : 55;
      this.camera.updateProjectionMatrix();
      this.gun.visible = !this.scope;
      this.gun.position.z = Math.max(0, s.cooldown - 0.6) * 0.12;
    }
    this.updateMarkers(s);
    if (s.lastImpact && s.lastImpact.at !== this.lastShot) {
      this.lastShot = s.lastImpact.at;
      this.tracer.geometry.dispose();
      this.tracer.geometry = new T.BufferGeometry().setFromPoints([
        this.camera.position.clone().add(new T.Vector3(0.1, -0.3, -0.2)),
        new T.Vector3(...s.lastImpact.pos),
      ]);
    }
    this.tracer.visible = !!s.lastImpact && s.elapsed - s.lastImpact.at < 0.13;
  }
  private updateMarkers(s: Session) {
    const points: T.Vector3[] = [];
    for (const a of [...s.enemies, ...s.helpers]) {
      if (a.state === "disposed") continue;
      const d = this.camera.position.distanceTo(new T.Vector3(...a.pos));
      if (
        a.helper ||
        a.marked > 0 ||
        (s.equip.marking && d < s.equip.marking)
      ) {
        const x = a.pos[0],
          y = a.pos[1] + 2.3,
          z = a.pos[2];
        points.push(
          new T.Vector3(x - 0.3, y + 0.2, z),
          new T.Vector3(x, y, z),
          new T.Vector3(x, y, z),
          new T.Vector3(x + 0.3, y + 0.2, z),
        );
      }
      if (s.equip.predict && d < s.equip.perception) {
        points.push(
          new T.Vector3(...a.pos).add(new T.Vector3(0, 0.1, 0)),
          new T.Vector3(...a.route[a.waypoint % a.route.length]).add(
            new T.Vector3(0, 0.1, 0),
          ),
        );
      }
    }
    this.markers.geometry.dispose();
    this.markers.geometry = new T.BufferGeometry().setFromPoints(points);
  }
  shoot(s: Session) {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(new T.Vector2(0, 0), this.camera);
    const objects = [
      ...this.world!.colliders,
      ...[...this.models.values()]
        .filter((m) => {
          const a = [...s.enemies, ...s.helpers].find(
            (a) => a.id === m.hit.userData.actorId,
          );
          return a?.state !== "disposed";
        })
        .map((m) => m.hit),
    ];
    const center = this.ray.intersectObjects(objects, false)[0];
    const range = center?.distance ?? 100;
    const ammo = catalogAmmo(s);
    const offset = new T.Vector3(
      ...ballisticOffset(range, ammo * s.equip.velocity, s.mission.wind),
    );
    const target = this.ray.ray.origin
      .clone()
      .addScaledVector(this.ray.ray.direction, range)
      .add(offset);
    this.ray.set(
      this.camera.position,
      target.sub(this.camera.position).normalize(),
    );
    this.ray.far = 1000;
    const hit = this.ray.intersectObjects(objects, false)[0];
    const id = hit?.object.userData.actorId ?? null;
    const a = [...s.enemies, ...s.helpers].find((a) => a.id === id);
    const critical = !!a && !!hit && hit.point.y > a.pos[1] + a.scale * 1.08;
    return s.fire(
      id,
      critical,
      !!hit?.object.userData.collateral,
      hit
        ? hit.point.toArray()
        : this.ray.ray.at(100, new T.Vector3()).toArray(),
    );
  }
  targetInfo(s: Session) {
    this.scene.updateMatrixWorld();
    this.ray.setFromCamera(new T.Vector2(), this.camera);
    const hit = this.ray.intersectObjects(
      [
        ...this.world!.colliders,
        ...[...this.models.values()]
          .filter(
            (m) =>
              s.enemies.some(
                (a) =>
                  a.id === m.hit.userData.actorId && a.state !== "disposed",
              ) || s.helpers.some((a) => a.id === m.hit.userData.actorId),
          )
          .map((m) => m.hit),
      ],
      false,
    )[0];
    return {
      range: hit?.distance ?? 100,
      actor: [...s.enemies, ...s.helpers].find(
        (a) => a.id === hit?.object.userData.actorId,
      ),
      point: hit?.point,
    };
  }
  project(a: Actor) {
    return new T.Vector3(a.pos[0], a.pos[1] + a.scale * 0.95, a.pos[2]).project(
      this.camera,
    );
  }
  render(dt: number) {
    if (this.gallery) {
      this.camera.position.set(
        Math.sin(this.galleryAngle) * 13,
        6,
        Math.cos(this.galleryAngle) * 13 - 2,
      );
      this.camera.lookAt(0, 1, -2);
      for (const m of this.galleryModels)
        m.update(performance.now() / 1000, "idle");
    }
    this.renderer.render(this.scene, this.camera);
    if (dt > 0 && dt < 1) {
      this.frames.push(dt);
      if (this.frames.length > 120) this.frames.shift();
      this.fps = this.frames.length / this.frames.reduce((a, b) => a + b, 0);
    }
  }
  metrics() {
    return {
      fps: this.fps,
      ...this.renderer.info.memory,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      actors: this.models.size,
      drops: this.dropModels.size,
      resources: this.lib.resourceCount,
    };
  }
  dispose() {
    this.clearActors();
    this.world?.dispose();
    this.markerGeometry.dispose();
    this.markers.geometry.dispose();
    this.markerMaterial.dispose();
    this.tracer.geometry.dispose();
    (this.tracer.material as T.Material).dispose();
    this.fragmentMesh.dispose();
    this.burstMesh.dispose();
    (this.burstMesh.material as T.Material).dispose();
    this.lib.dispose();
    this.renderer.dispose();
  }
}
import { catalog } from "../data/content";
function catalogAmmo(s: Session) {
  return catalog.ammo.find((a) => a.id === s.ammo)!.muzzle_velocity;
}
