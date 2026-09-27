import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
const checkpoint = process.env.JOURNEY_RESUME
  ? JSON.parse(readFileSync(process.env.JOURNEY_RESUME, "utf8"))
  : undefined;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const runs = checkpoint?.runs ?? [],
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const read = () =>
  page.evaluate(() => {
    const a = window.testApp,
      s = a.session;
    return {
      paused: a.paused,
      finished: s?.finished,
      rounds: s?.rounds,
      result: s?.result,
      progress: a.store.value,
    };
  });
try {
  if (checkpoint)
    await page.addInitScript((p) => {
      if (!sessionStorage.getItem("journey-checkpoint-loaded")) {
        localStorage.setItem("highground.web.v1", JSON.stringify(p));
        sessionStorage.setItem("journey-checkpoint-loaded", "1");
      }
    }, checkpoint.state.progress);
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
  });
  const missions = await page.evaluate(async () => {
    const { catalog } = await import("/src/data/content.ts");
    return catalog.missions.map((m) => ({
      id: m.id,
      map: m.map,
      prerequisite: m.prerequisite_mission,
      required: m.required_missions ?? [],
    }));
  });
  const remaining = missions.filter(
    (m) => !(checkpoint?.state.progress.completed ?? []).includes(m.id),
  );
  assert.equal(
    (await read()).progress.completed.length,
    checkpoint?.state.progress.completed.length ?? 0,
  );
  while (remaining.length) {
    const progress = (await read()).progress;
    const index = remaining.findIndex(
      (m) =>
        (!m.prerequisite || progress.completed.includes(m.prerequisite)) &&
        m.required.every((id) => progress.completed.includes(id)),
    );
    assert.ok(index >= 0, "Reachable next mission");
    const mission = remaining.splice(index, 1)[0];
    await page.getByRole("button", { name: "任務板", exact: true }).click();
    await page.locator(`[data-action="map"][data-id="${mission.map}"]`).click();
    await page
      .locator(`[data-action="brief"][data-id="${mission.id}"]`)
      .click();
    await page.locator('[data-action="deploy"]').click();
    await page.waitForTimeout(200);
    assert.equal((await read()).paused, false);
    let attempts = 0;
    while (!(await read()).finished && attempts++ < 350) {
      if (!(await read()).rounds) {
        await page.keyboard.press("r");
        await page.waitForTimeout(2100);
      }
      // Only camera aiming is automated. Targets retain real positions/routes;
      // an obstructed view waits for another shooting window.
      const visible = await page.evaluate(async () => {
        const a = window.testApp,
          s = a.session,
          v = a.view;
        const T = await import("/node_modules/three/build/three.module.js");
        const { ballisticOffset } = await import("/src/game/rules.ts");
        for (const actor of s.enemies.filter((e) => e.state !== "disposed")) {
          for (const [dx, dy] of [[0,.97],[0,1.4],[-.4,1.2],[.4,1.2],[-.7,.85],[.7,.85],[0,.45]]) {
          const target = new T.Vector3(
            actor.pos[0] + actor.scale * dx,
            actor.pos[1] + actor.scale * dy,
            actor.pos[2],
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
          v.pitch = v.camera.rotation.x;
          v.yaw = v.camera.rotation.y;
          // Trace the actual wind-adjusted renderer ray without mutating rules.
          // The only real shot remains the subsequent native mouse press.
          let safe = false;
          const fire = s.fire;
          s.fire = (id, critical, collateral) => {
            safe = id === actor.id && !collateral;
            return false;
          };
          try {
            v.shoot(s);
          } finally {
            s.fire = fire;
          }
          if (safe) return true;
          }
        }
        return false;
      });
      if (visible) {
        await page.waitForTimeout(20);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(790);
      } else await page.waitForTimeout(400);
    }
    const state = await read();
    assert.equal(state.result?.completed, true, mission.id + " completion");
    assert.ok(state.progress.completed.includes(mission.id));
    assert.ok(state.progress.workshop >= 0 && state.progress.community >= 0);
    runs.push({
      mission: mission.id,
      result: state.result,
      workshop: state.progress.workshop,
      community: state.progress.community,
    });
    writeFileSync(
      "test-results/campaign-journey-progress.json",
      JSON.stringify({ runs, errors }, null, 2),
    );
    console.log(mission.id + " completed; " + runs.length + "/19");
    await page.locator('.result [data-action="campaign"]').click();
  }
  await page.reload();
  await page.waitForSelector(".hero");
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("highground.web.v1")),
  );
  assert.equal(restored.completed.length, 19);
  assert.deepEqual(errors, []);
  writeFileSync(
    "test-results/campaign-journey.json",
    JSON.stringify(
      {
        runs,
        errors,
        restored,
        resumedFromBrowserCheckpoint: !!checkpoint,
        priorFailedAttempt: checkpoint?.state.result,
        completed: true,
      },
      null,
      2,
    ),
  );
} catch (e) {
  await page.screenshot({ path: "test-results/campaign-journey-failure.png" });
  writeFileSync(
    "test-results/campaign-journey-failure.json",
    JSON.stringify(
      { error: String(e), runs, errors, state: await read() },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
