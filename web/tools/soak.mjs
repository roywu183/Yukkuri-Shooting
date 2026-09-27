import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const sourceFiles = readdirSync("src", { recursive: true })
  .filter((f) => /\.(ts|css|json)$/.test(f))
  .sort();
const hashSources = () => {
  const hash = createHash("sha256");
  for (const file of sourceFiles)
    hash.update(file).update(readFileSync("src/" + file));
  return hash.digest("hex");
};
const sourceHash = hashSources();
mkdirSync("test-results", { recursive: true });
const channel = process.env.BROWSER_CHANNEL ?? "chrome",
  duration = Number(process.env.SOAK_SECONDS ?? 1800);
const browser = await chromium.launch({
  channel,
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:5173/");
await page.waitForSelector(".hero");
await page.evaluate(async () => {
  const { app } = await import("/src/main.ts");
  const { catalog } = await import("/src/data/content.ts");
  app.store.value.completed = catalog.missions.map((m) => m.id);
  app.store.value.community = 100000;
  for (const u of catalog.upgrades) app.store.value.upgrades[u.id] = 1;
  for (const h of catalog.helpers) app.store.value.helpers[h.id] = 3;
  app.store.value.loadouts.factory = ["factory_collector", "factory_scout"];
  app.store.save();
});
await page.getByRole("button", { name: "地圖冊", exact: true }).click();
await page.locator('[data-action="map"][data-id="factory"]').click();
await page.locator('[data-action="start-free"]').click();
await page.locator('[data-action="deploy"]').click();
await page.waitForTimeout(500);
const state = await page.evaluate(async () => {
  const { app } = await import("/src/main.ts");
  return { paused: app.paused, mode: app.session?.mode };
});
if (state.paused)
  throw Error("Pointer lock did not activate: " + JSON.stringify(state));
const started = Date.now(),
  samples = [];
let cycle = 0,
  lastSample = -1;
try {
  while (Date.now() - started < duration * 1000) {
    await page.evaluate(async (cycle) => {
      const { app } = await import("/src/main.ts");
      const { ballisticOffset } = await import("/src/game/rules.ts");
      const T = await import("/node_modules/three/build/three.module.js");
      const s = app.session;
      if (!s || app.paused) throw Error("Soak paused");
      if (!s.rounds) s.reload();
      const a = s.enemies.find((a) => a.state !== "disposed");
      if (!a) return;
      const target = new T.Vector3(
          a.pos[0],
          a.pos[1] + a.scale * 0.95,
          a.pos[2],
        ),
        range = target.distanceTo(app.view.camera.position);
      target.sub(
        new T.Vector3(
          ...ballisticOffset(range, 500 * s.equip.velocity, s.mission.wind),
        ),
      );
      app.view.camera.lookAt(target);
      app.view.pitch = app.view.camera.rotation.x;
      app.view.yaw = app.view.camera.rotation.y;
      app.view.scope = cycle % 4 !== 0;
      s.ammo = [
        "standard",
        "standard",
        "coffee",
        "marble_soda",
        "budding",
        "chili",
      ][cycle % 6];
      s.collect();
    }, cycle++);
    await page.waitForTimeout(100);
    await page.mouse.click(960, 540);
    await page.waitForTimeout(1100);
    const elapsed = (Date.now() - started) / 1000;
    if (Math.floor(elapsed / 30) !== lastSample) {
      lastSample = Math.floor(elapsed / 30);
      const sample = await page.evaluate(async () => {
        const { app } = await import("/src/main.ts");
        const s = app.session;
        const gl = app.view.renderer.getContext(),
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          ...app.view.metrics(),
          simSeconds: s.elapsed,
          spawned: s.spawned,
          kills: s.stats.kills,
          pending: s.pending.length,
          active: s.activeCount,
          jsHeap: performance.memory?.usedJSHeapSize,
          gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown",
        };
      });
      samples.push({ wallSeconds: elapsed, ...sample });
      writeFileSync(
        `test-results/soak-${channel}-progress.json`,
        JSON.stringify({ duration, elapsed, samples, errors }, null, 2),
      );
      console.log(JSON.stringify(samples.at(-1)));
    }
  }
  await page.screenshot({ path: `test-results/soak-${channel}.png` });
  await page.keyboard.press("Escape");
  await page.locator('[data-action="leave"]').click();
  await page.waitForSelector(".result");
  assert.equal(hashSources(), sourceHash, "Source changed during soak");
  assert.ok(
    samples.every(
      (s) => s.active + s.pending <= 24 && s.drops <= 24 && s.actors <= 50,
    ),
    "Population bounds",
  );
  const stable = samples.filter((s) => s.wallSeconds >= 60);
  assert.ok(
    Math.max(...stable.map((s) => s.geometries)) -
      Math.min(...stable.map((s) => s.geometries)) <=
      3,
    "GPU geometry growth",
  );
  assert.ok(
    Math.max(...stable.map((s) => s.textures)) -
      Math.min(...stable.map((s) => s.textures)) <=
      2,
    "Texture growth",
  );
  const report = {
    sourceHash,
    channel,
    requestedSeconds: duration,
    wallSeconds: (Date.now() - started) / 1000,
    samples,
    errors,
    completed: true,
  };
  writeFileSync(
    `test-results/soak-${channel}.json`,
    JSON.stringify(report, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
