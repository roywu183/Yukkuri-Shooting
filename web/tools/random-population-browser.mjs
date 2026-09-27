import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const channel = process.env.BROWSER_CHANNEL ?? "chrome";
const browser = await chromium.launch({ channel, headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [],
  runs = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
    const { catalog } = await import("/src/data/content.ts");
    window.testApp.store.value.completed = catalog.missions.map((m) => m.id);
    window.testApp.store.save();
  });
  for (const map of [
    "park",
    "city",
    "residential",
    "shopping_street",
    "factory",
    "rural",
    "joint",
  ]) {
    await page.getByRole("button", { name: "任務板", exact: true }).click();
    await page.locator(`[data-action="map"][data-id="${map}"]`).click();
    await page.locator('[data-action="brief"]').first().click();
    await page.locator('[data-action="deploy"]').click();
    await page.waitForTimeout(150);
    const before = await page.evaluate(() =>
      window.testApp.session.enemies.map((a) => ({
        id: a.id,
        pos: [...a.pos],
        scale: a.scale,
        species: a.species,
      })),
    );
    await page.waitForTimeout(3500);
    const state = await page.evaluate(async () => {
      const a = window.testApp,
        s = a.session,
        v = a.view;
      const T = await import("/node_modules/three/build/three.module.js");
      const { walkable } = await import("/src/game/navigation.ts");
      const collisions = [];
      v.scene.updateMatrixWorld(true);
      for (const actor of s.enemies) {
        if (!walkable(s.mission.map, actor.pos, actor.scale * 1.1))
          collisions.push({ id: actor.id, kind: "navigation" });
        const body = new T.Box3(
          new T.Vector3(
            actor.pos[0] - 0.75 * actor.scale,
            actor.pos[1] + 0.2 * actor.scale,
            actor.pos[2] - 0.65 * actor.scale,
          ),
          new T.Vector3(
            actor.pos[0] + 0.75 * actor.scale,
            actor.pos[1] + 1.5 * actor.scale,
            actor.pos[2] + 0.65 * actor.scale,
          ),
        );
        for (const solid of v.world.colliders) {
          const box = new T.Box3().setFromObject(solid);
          if (body.intersectsBox(box))
            collisions.push({
              id: actor.id,
              kind: "scenery",
              at: solid.position.toArray(),
            });
        }
      }
      return {
        paused: a.paused,
        actors: s.enemies.map((a) => ({
          id: a.id,
          pos: [...a.pos],
          scale: a.scale,
          species: a.species,
          speed: a.speed,
        })),
        collisions,
        metrics: v.metrics(),
      };
    });
    assert.equal(state.paused, false);
    assert.deepEqual(state.collisions, [], `${map}: body intersects scenery`);
    assert.ok(
      state.actors.some(
        (a) =>
          Math.hypot(
            a.pos[0] - before.find((b) => b.id === a.id).pos[0],
            a.pos[2] - before.find((b) => b.id === a.id).pos[2],
          ) > 1,
      ),
    );
    assert.ok(new Set(state.actors.map((a) => a.scale)).size > 4);
    runs.push({ map, ...state });
    if (map === "park")
      await page.screenshot({ path: `test-results/random-${channel}.png` });
    if (map === "park") {
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.evaluate(async () => {
          const { ballisticOffset } = await import("/src/game/rules.ts");
          const T = await import("/node_modules/three/build/three.module.js");
          const { session: s, view: v } = window.testApp;
          for (const a of s.enemies.filter((a) => a.state !== "disposed")) {
            const target = new T.Vector3(
              a.pos[0],
              a.pos[1] + a.scale * 0.95,
              a.pos[2],
            );
            target.sub(
              new T.Vector3(
                ...ballisticOffset(
                  target.distanceTo(v.camera.position),
                  500 * s.equip.velocity,
                  s.mission.wind,
                ),
              ),
            );
            v.camera.lookAt(target);
            v.yaw = v.camera.rotation.y;
            v.pitch = v.camera.rotation.x;
            const fire = s.fire;
            let safe = false;
            s.fire = (id, critical, collateral) => {
              safe = id === a.id && !collateral;
              return false;
            };
            try {
              v.shoot(s);
            } finally {
              s.fire = fire;
            }
            if (safe) return;
          }
        });
        await page.waitForTimeout(30);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(850);
        if (await page.evaluate(() => window.testApp.session.stats.kills > 0))
          break;
      }
      const kills = await page.evaluate(
        () => window.testApp.session.stats.kills,
      );
      assert.ok(
        kills > 0,
        "Random-sized moving actor can be hit through real pointer input",
      );
      runs.at(-1).verifiedShotKills = kills;
    }
    await page.keyboard.press("Escape");
    await page.locator('[data-action="leave"]').click();
    await page.locator('.result [data-action="campaign"]').click();
  }
  assert.deepEqual(errors, []);
  mkdirSync("validation/random-population", { recursive: true });
  writeFileSync(
    `validation/random-population/${channel}.json`,
    JSON.stringify({ completed: true, runs, errors }, null, 2),
  );
  console.log(
    channel + ": seven maps random movement, sizes and scenery bounds passed",
  );
} catch (e) {
  console.error(e);
  await page.screenshot({ path: `test-results/random-${channel}-failure.png` });
  throw e;
} finally {
  await browser.close();
}
