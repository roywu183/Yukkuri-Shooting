import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const channel = process.env.BROWSER_CHANNEL ?? "chrome";
const out = "validation/ammo-effects";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel, headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const report = { channel, errors };
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
    const { catalog } = await import("/src/data/content.ts");
    window.testApp.store.value.completed = catalog.missions.map((m) => m.id);
    for (const id of ["chili", "budding"])
      window.testApp.store.value.upgrades["license_" + id] = 1;
  });
  await page.getByRole("button", { name: "任務板", exact: true }).click();
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(150);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(100);
  const start = await page.evaluate(() => window.testApp.view.camera.fov);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(150);
  const zoomIn = await page.evaluate(() => window.testApp.view.camera.fov);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  const zoomOut = await page.evaluate(() => window.testApp.view.camera.fov);
  assert.ok(zoomIn < start);
  assert.equal(zoomOut, start);
  report.wheel = { start, zoomIn, zoomOut };
  // Pause only simulation for reproducible visual fixtures. Real DOM wheel above is unmodified.
  await page.evaluate(() => {
    const a = window.testApp;
    a.paused = true;
    a.view.scope = false;
    a.hud.innerHTML = "";
  });
  async function fixture(ammo, seed) {
    return page.evaluate(
      async ({ ammo, seed }) => {
        const { Session } = await import("/src/game/rules.ts");
        const { missionById, ammoOrder } = await import("/src/data/content.ts");
        const a = window.testApp,
          s = new Session(missionById("park_01"), "free", a.store.value, seed);
        a.session = s;
        s.availableAmmo = ammoOrder;
        s.ammo = ammo;
        for (const e of s.enemies) {
          e.state = "sleep";
          e.statusTime = 100;
          e.pos = [23, 0, -44];
        }
        const target = s.enemies[0];
        target.species = "reimu";
        target.scale = 1;
        target.pos = [0, 0, -6];
        target.route = [
          [0, 0, -6],
          [0, 0, -2],
        ];
        target.waypoint = 1;
        if (ammo === "chili") {
          s.enemies[1].pos = [2, 0, -6];
          s.enemies[1].scale = 1;
          s.enemies[2].pos = [4, 0, -6];
          s.enemies[2].scale = 1;
        }
        a.view.clearActors();
        a.view.camera.position.set(5, 4, 5);
        a.view.camera.lookAt(0, 1.6, -6);
        a.view.camera.fov = 38;
        a.view.camera.updateProjectionMatrix();
        s.fire(target.id);
        return { count: s.pending.length };
      },
      { ammo, seed },
    );
  }
  async function step(seconds) {
    return page.evaluate((seconds) => {
      const a = window.testApp,
        s = a.session;
      for (let i = 0; i < Math.ceil(seconds * 120); i++) s.tick(1 / 120);
      a.view.sync(s, 0, false);
      a.view.render(0);
      return {
        kills: s.stats.kills,
        fragments: s.fragments.length,
        pending: s.pending.length,
        children: s.childSpawns,
        falling: s.enemies.filter((e) => e.birth).length,
        bursts: s.bursts.length,
      };
    }, seconds);
  }
  await fixture("chili", 7);
  await step(0.2);
  await page.screenshot({ path: `${out}/${channel}-red.png` });
  report.initialExplosion = await step(0.55);
  assert.ok(report.initialExplosion.fragments > 0);
  await page.screenshot({ path: `${out}/${channel}-fragments.png` });
  report.chain = await step(2);
  assert.ok(report.chain.kills >= 3);
  report.cleanup = await step(3);
  assert.equal(report.cleanup.fragments, 0);
  assert.equal(report.cleanup.bursts, 0);
  report.buds = [];
  const seen = new Set();
  for (let seed = 1; seed < 30 && seen.size < 3; seed++) {
    const { count } = await fixture("budding", seed);
    if (seen.has(count)) continue;
    seen.add(count);
    await step(2);
    const mounted = await page.evaluate(() => {
      const a = window.testApp,
        m = a.view.models.get(a.session.enemies[0].id),
        stem = m.root.getObjectByName("budding-stem");
      return {
        visible: stem.visible,
        count: stem.children.filter((c) => c.name === "hanging-yukkuri").length,
      };
    });
    assert.equal(mounted.count, count);
    assert.ok(mounted.visible);
    await page.screenshot({ path: `${out}/${channel}-buds-${count}.png` });
    if (count === 3) {
      await page.evaluate(() => {
        const v = window.testApp.view;
        v.camera.position.set(9, 3, -3);
        v.camera.lookAt(0, 1.4, -5);
      });
      await page.screenshot({ path: `${out}/${channel}-buds-side.png` });
    }
    const before = await step(2.9);
    assert.equal(before.children, 0);
    const born = await step(0.2);
    assert.equal(born.children, count);
    assert.equal(born.falling, count);
    const landed = await step(0.8);
    assert.equal(landed.falling, 0);
    report.buds.push({ count, mounted, before, born, landed });
  }
  assert.equal(seen.size, 3);
  await fixture("budding", 7);
  report.unlimited = await page.evaluate(() => {
    const a = window.testApp,
      s = a.session,
      parents = [...s.enemies];
    let expected = s.pending.length;
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const p of parents) {
        if (s.pending.some((b) => b.parentId === p.id)) continue;
        s.cooldown = 0;
        s.rounds = 5;
        s.fire(p.id);
        const count = s.pending.filter((b) => b.parentId === p.id).length;
        if (!count) throw Error("芽殖被拒絕");
        expected += count;
      }
      for (let i = 0; i < 360; i++) s.tick(1 / 60);
    }
    a.view.sync(s, 0, false);
    return {
      expected,
      born: s.childSpawns,
      active: s.activeCount,
      pending: s.pending.length,
    };
  });
  assert.equal(report.unlimited.born, report.unlimited.expected);
  assert.equal(report.unlimited.pending, 0);
  assert.ok(report.unlimited.active > 24);
  await page.screenshot({ path: `${out}/${channel}-unlimited.png` });
  assert.deepEqual(errors, []);
  report.metrics = await page.evaluate(() => window.testApp.view.metrics());
  report.completed = true;
  writeFileSync(`${out}/${channel}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
