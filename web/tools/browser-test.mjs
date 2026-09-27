import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
const channel = process.env.BROWSER_CHANNEL ?? "chrome";
const browser = await chromium.launch({
  channel,
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [],
  runs = [];
page.on("pageerror", (e) => errors.push(String(e)));
const read = () =>
  page.evaluate(async () => {
    const { app } = await import("/src/main.ts");
    const s = app.session;
    return {
      screen: app.screen,
      paused: app.paused,
      finished: s?.finished,
      kills: s?.stats.kills,
      rounds: s?.rounds,
      reload: s?.reloadLeft,
      elapsed: s?.elapsed,
      result: s?.result,
      metrics: app.view.metrics(),
    };
  });
async function aim(index = 0) {
  return page.evaluate(async (index) => {
    const { app } = await import("/src/main.ts");
    const { ballisticOffset } = await import("/src/game/rules.ts");
    const T = await import("/node_modules/three/build/three.module.js");
    const s = app.session,
      actors = s.enemies.filter((a) => a.state !== "disposed");
    const a = actors[index % actors.length];
    if (!a) return false;
    const target = new T.Vector3(a.pos[0], a.pos[1] + a.scale * 0.97, a.pos[2]);
    const range = target.distanceTo(app.view.camera.position);
    target.sub(
      new T.Vector3(
        ...ballisticOffset(range, 500 * s.equip.velocity, s.mission.wind),
      ),
    );
    app.view.camera.lookAt(target);
    app.view.pitch = app.view.camera.rotation.x;
    app.view.yaw = app.view.camera.rotation.y;
    return true;
  }, index);
}
async function shoot(index = 0) {
  const state = await read();
  if (!state.rounds) {
    await page.keyboard.press("r");
    await page.waitForTimeout(2150);
  }
  await aim(index);
  await page.waitForTimeout(65);
  await page.mouse.click(960, 540);
  await page.waitForTimeout(825);
}
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  assert.equal(await page.locator(".hero h1").count(), 1);
  await page.evaluate(async () => {
    const { app } = await import("/src/main.ts");
    const { catalog } = await import("/src/data/content.ts");
    app.store.value.completed = catalog.missions.map((m) => m.id);
    app.store.value.community = 1000;
    app.store.value.workshop = 2000;
    app.store.save();
  });
  for (const map of [
    "park",
    "city",
    "residential",
    "shopping_street",
    "factory",
    "rural",
  ]) {
    await page.getByRole("button", { name: "任務板", exact: true }).click();
    await page.locator(`[data-action="map"][data-id="${map}"]`).click();
    await page.locator('[data-action="brief"]').first().click();
    await page.locator('[data-action="deploy"]').click();
    await page.waitForTimeout(250);
    assert.equal((await read()).paused, false, "mission pointer lock");
    await page.mouse.click(960, 540, { button: "right" });
    await aim(0);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test-results/${channel}-${map}-scope.png` });
    if (map === "park") {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".pause");
      const t = (await read()).elapsed;
      await page.waitForTimeout(400);
      assert.equal((await read()).elapsed, t, "paused clock");
      await page.mouse.click(10, 10);
      assert.equal((await read()).elapsed, t);
      await page.locator('[data-action="resume"]').click();
      await page.waitForTimeout(100);
      assert.equal((await read()).paused, false);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        1280,
      );
      await page.setViewportSize({ width: 1920, height: 1080 });
    }
    let attempts = 0,
      stuck = 0,
      lastKills = 0;
    while (!(await read()).finished && attempts++ < 100) {
      await shoot(stuck);
      const r = await read();
      if (r.kills === lastKills) stuck++;
      else stuck = 0;
      lastKills = r.kills;
    }
    let state = await read();
    assert.equal(state.finished, true, `${map} campaign must finish`);
    assert.equal(state.result.completed, true, `${map} clear conditions`);
    runs.push({
      map,
      mode: "campaign",
      ...state.result,
      metrics: state.metrics,
    });
    await page.locator('.result [data-action="campaign"]').click();
    await page.getByRole("button", { name: "地圖冊", exact: true }).click();
    await page.locator(`[data-action="map"][data-id="${map}"]`).click();
    await page.locator('[data-action="start-free"]').click();
    await page.locator('[data-action="deploy"]').click();
    await page.waitForTimeout(200);
    for (let i = 0; i < 4; i++) await shoot(i);
    await page.keyboard.press("e");
    await page.keyboard.press("Escape");
    await page.waitForSelector(".pause");
    await page.locator('[data-action="leave"]').click();
    await page.waitForSelector(".result");
    state = await read();
    assert.ok(state.result.stats.kills > 0);
    runs.push({ map, mode: "free", ...state.result, metrics: state.metrics });
    await page.locator('.result [data-action="free"]').click();
    console.log(`${channel} ${map}: campaign + free passed`);
  }
  await page.getByRole("button", { name: "軍械櫃", exact: true }).click();
  await page
    .locator('[data-action="purchase"][data-id="rifle_speed_1"]')
    .click();
  await page.reload();
  await page.waitForSelector(".hero");
  assert.equal(
    await page.evaluate(async () => {
      const { app } = await import("/src/main.ts");
      return app.store.value.upgrades.rifle_speed_1;
    }),
    1,
  );
  await page.getByRole("button", { name: "模型展示", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-action="rotate"][data-id="1"]').click();
    await page.waitForTimeout(50);
  }
  await page.screenshot({ path: `test-results/${channel}-models-back.png` });
  await page.locator('[data-action="helper-preview"]').click();
  await page.screenshot({ path: `test-results/${channel}-models-helper.png` });
  assert.deepEqual(errors, []);
  writeFileSync(
    `test-results/browser-${channel}.json`,
    JSON.stringify({ channel, runs, errors, completed: true }, null, 2),
  );
  console.log(`${channel}: all browser checks passed`);
} catch (error) {
  await page
    .screenshot({ path: `test-results/${channel}-failure.png` })
    .catch(() => {});
  writeFileSync(
    `test-results/browser-${channel}-failure.json`,
    JSON.stringify(
      {
        error: String(error),
        runs,
        errors,
        state: await read().catch(() => null),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
